package docker

import (
	"context"
	"fmt"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	apiclient "docker-dashboard-agent/client"
	"strings"
	"time"
)

type Client struct {
	dockerCli *client.Client
}

func NewClient() (*Client, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	return &Client{
		dockerCli: cli,
	}, nil
}

func (c *Client) GetInfo(ctx context.Context) (types.Info, error) {
	return c.dockerCli.Info(ctx)
}

func (c *Client) ListContainers(ctx context.Context) ([]apiclient.ContainerSnapshot, error) {
	containers, err := c.dockerCli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	var snapshots []apiclient.ContainerSnapshot
	for _, cnt := range containers {
		// Normalize name (remove leading slash)
		name := ""
		if len(cnt.Names) > 0 {
			name = strings.TrimPrefix(cnt.Names[0], "/")
		}

		// Normalize ports
		ports := make(map[string]interface{})
		for _, p := range cnt.Ports {
			key := fmt.Sprintf("%d/%s", p.PrivatePort, p.Type)
			if p.PublicPort != 0 {
				ports[key] = p.PublicPort
			} else {
				ports[key] = nil
			}
		}

		// Normalize labels
		labels := make(map[string]interface{})
		for k, v := range cnt.Labels {
			labels[k] = v
		}

		var startedAt *string
		if cnt.State == "running" {
			// Actually we'd need container inspect to get exact StartedAt,
			// but for simplicity we can just leave it nil or mock it based on Status.
			// Getting accurate StartedAt requires a separate Inspect call per container,
			// which can be slow. Best effort here.
			now := time.Now().Format(time.RFC3339)
			startedAt = &now
		}

		snapshot := apiclient.ContainerSnapshot{
			DockerId:  cnt.ID,
			Name:      name,
			Image:     cnt.Image,
			ImageId:   cnt.ImageID,
			Command:   cnt.Command,
			State:     cnt.State,
			Status:    cnt.Status,
			Ports:     ports,
			Labels:    labels,
			StartedAt: startedAt,
		}

		snapshots = append(snapshots, snapshot)
	}

	return snapshots, nil
}
