package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"docker-dashboard-agent/client"
	"docker-dashboard-agent/docker"
)

func main() {
	enrollPtr := flag.String("enroll", "", "Enrollment token to register this agent")
	apiUrlPtr := flag.String("api-url", "http://localhost:3000", "Base URL of the Cloud API")
	flag.Parse()

	apiURL := os.Getenv("AGENT_API_URL")
	if apiURL == "" {
		apiURL = *apiUrlPtr
	}

	enrollToken := os.Getenv("AGENT_TOKEN")
	if enrollToken == "" {
		enrollToken = *enrollPtr
	}

	// In a real agent, we would read/write the identity token to a local config file.
	// For this phase, we'll keep it simple and just use memory, assuming the agent is run persistently.
	// If it restarts, it would need a new enrollment token or load the saved identity token.

	if enrollToken == "" {
		log.Fatal("AGENT_TOKEN environment variable or --enroll flag is required for first run")
	}

	api := client.NewAPIClient(apiURL, "")
	dockerCli, err := docker.NewClient()
	if err != nil {
		log.Fatalf("Failed to initialize Docker client: %v", err)
	}

	ctx := context.Background()
	info, err := dockerCli.GetInfo(ctx)
	if err != nil {
		log.Fatalf("Failed to get Docker info: %v", err)
	}

	hostname, _ := os.Hostname()

	log.Printf("Enrolling agent with cloud at %s...", apiURL)
	enrollResp, err := api.Enroll(client.EnrollRequest{
		Token:         enrollToken,
		Name:          hostname,
		Hostname:      hostname,
		OS:            runtime.GOOS,
		Architecture:  runtime.GOARCH,
		DockerVersion: info.ServerVersion,
	})

	if err != nil {
		log.Fatalf("Enrollment failed: %v", err)
	}

	log.Printf("Successfully enrolled. Host ID: %s", enrollResp.HostId)
	log.Printf("Starting agent loops...")

	// Setup graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Tickers
	heartbeatTicker := time.NewTicker(30 * time.Second)
	syncTicker := time.NewTicker(10 * time.Second)

	// Initial sync immediately
	doSync(ctx, api, dockerCli)

	for {
		select {
		case <-heartbeatTicker.C:
			if err := api.Heartbeat(); err != nil {
				log.Printf("Heartbeat failed: %v", err)
			} else {
				log.Println("Heartbeat sent.")
			}
		case <-syncTicker.C:
			doSync(ctx, api, dockerCli)
		case <-stop:
			log.Println("Agent shutting down...")
			heartbeatTicker.Stop()
			syncTicker.Stop()
			os.Exit(0)
		}
	}
}

func doSync(ctx context.Context, api *client.APIClient, dockerCli *docker.Client) {
	containers, err := dockerCli.ListContainers(ctx)
	if err != nil {
		log.Printf("Failed to list containers: %v", err)
		return
	}

	if err := api.SyncContainers(containers); err != nil {
		log.Printf("Failed to sync containers: %v", err)
	} else {
		log.Printf("Synced %d containers.", len(containers))
	}
}
