package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"runtime"
	"sync"
	"syscall"
	"time"

	"docker-dashboard-agent/client"
	"docker-dashboard-agent/docker"
)

func main() {
	enrollPtr := flag.String("enroll", "", "Enrollment token to register this agent")
	apiUrlPtr := flag.String("api-url", "http://localhost:3001", "Base URL of the Cloud API")
	flag.Parse()

	apiURL := os.Getenv("AGENT_API_URL")
	if apiURL == "" {
		apiURL = *apiUrlPtr
	}

	enrollToken := os.Getenv("AGENT_TOKEN")
	if enrollToken == "" {
		enrollToken = *enrollPtr
	}

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

	// ====== Phase 3: Connect WebSocket ======
	var wsClient *client.AgentWSClient
	actionHandler := func(actionId, containerId, action string) {
		log.Printf("Received action %s for container %s (ID: %s)", action, containerId, actionId)
		var err error
		switch action {
		case "START":
			err = dockerCli.StartContainer(ctx, containerId)
		case "STOP":
			err = dockerCli.StopContainer(ctx, containerId)
		case "RESTART":
			err = dockerCli.RestartContainer(ctx, containerId)
		default:
			err = fmt.Errorf("unknown action: %s", action)
		}

		if wsClient != nil {
			if err != nil {
				log.Printf("Action failed: %v", err)
				wsClient.SendActionResult(actionId, "FAILURE", err.Error())
			} else {
				log.Printf("Action succeeded")
				wsClient.SendActionResult(actionId, "SUCCESS", "")
			}
		}
	}

	wsClient = client.NewAgentWSClient(apiURL, enrollResp.AgentToken, actionHandler)
	if err := wsClient.Connect(); err != nil {
		log.Printf("Failed to connect to WebSocket: %v", err)
		// Usually we'd retry, but for simulation we just log
	} else {
		log.Printf("Successfully connected to Cloud WS.")
	}

	log.Printf("Starting agent loops...")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	heartbeatTicker := time.NewTicker(30 * time.Second)
	syncTicker := time.NewTicker(10 * time.Second)
	statsTicker := time.NewTicker(5 * time.Second)

	logStreams := make(map[string]context.CancelFunc)
	var logStreamsMu sync.Mutex

	doSync(ctx, api, dockerCli)

	for {
		select {
		case <-heartbeatTicker.C:
			if err := api.Heartbeat(); err != nil {
				log.Printf("Heartbeat failed: %v", err)
			}
		case <-syncTicker.C:
			doSync(ctx, api, dockerCli)

			// Manage log streams
			containers, _ := dockerCli.ListContainers(ctx)
			logStreamsMu.Lock()
			currentIds := make(map[string]bool)
			for _, c := range containers {
				if c.State == "running" {
					currentIds[c.DockerId] = true
					if _, exists := logStreams[c.DockerId]; !exists {
						streamCtx, cancel := context.WithCancel(context.Background())
						logStreams[c.DockerId] = cancel
						go streamLogsRoutine(streamCtx, c.DockerId, enrollResp.HostId, wsClient, dockerCli)
					}
				}
			}
			// Cancel stopped ones
			for id, cancel := range logStreams {
				if !currentIds[id] {
					cancel()
					delete(logStreams, id)
				}
			}
			logStreamsMu.Unlock()

		case <-statsTicker.C:
			// Collect and send stats
			containers, _ := dockerCli.ListContainers(ctx)
			var metrics []client.MetricItem
			for _, c := range containers {
				if c.State == "running" {
					statCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
					stats, err := dockerCli.GetContainerStats(statCtx, c.DockerId)
					cancel()
					if err == nil && stats != nil {
						metrics = append(metrics, *stats)
					}
				}
			}
			if len(metrics) > 0 && wsClient.Conn != nil {
				wsClient.SendMetrics(enrollResp.HostId, metrics)
			}

		case <-stop:
			log.Println("Agent shutting down...")
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
	_ = api.SyncContainers(containers)
}

func streamLogsRoutine(ctx context.Context, containerId string, hostId string, ws *client.AgentWSClient, dockerCli *docker.Client) {
	logChan := make(chan client.LogItem, 100)
	errChan := make(chan error, 1)

	go func() {
		errChan <- dockerCli.StreamContainerLogs(ctx, containerId, logChan)
	}()

	var batch []client.LogItem
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errChan:
			if err != nil {
				log.Printf("Stream error for container %s: %v", containerId, err)
			}
			return
		case item := <-logChan:
			batch = append(batch, item)
			if len(batch) >= 50 {
				ws.SendLogs(hostId, batch)
				batch = nil
			}
		case <-ticker.C:
			if len(batch) > 0 {
				ws.SendLogs(hostId, batch)
				batch = nil
			}
		}
	}
}
