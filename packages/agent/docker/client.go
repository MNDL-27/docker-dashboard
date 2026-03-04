package docker

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	apiclient "docker-dashboard-agent/client"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
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

		inspect, err := c.dockerCli.ContainerInspect(ctx, cnt.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to inspect container %s: %w", cnt.ID, err)
		}

		var startedAt *string
		if inspect.State != nil && inspect.State.StartedAt != "" && inspect.State.StartedAt != "0001-01-01T00:00:00Z" {
			startedAt = stringPtr(inspect.State.StartedAt)
		}

		var createdAt *string
		if inspect.Created != "" {
			createdAt = stringPtr(inspect.Created)
		}

		networks := make(map[string]interface{})
		if inspect.NetworkSettings != nil {
			for networkName, network := range inspect.NetworkSettings.Networks {
				networks[networkName] = map[string]interface{}{
					"networkId": network.NetworkID,
					"ipAddress": network.IPAddress,
					"gateway":   network.Gateway,
					"macAddress": network.MacAddress,
				}
			}
		}

		volumes := make([]string, 0, len(inspect.Mounts))
		for _, mount := range inspect.Mounts {
			if mount.Destination != "" {
				volumes = append(volumes, mount.Destination)
				continue
			}
			if mount.Name != "" {
				volumes = append(volumes, mount.Name)
			}
		}

		restartCount := 0
		if inspect.State != nil {
			restartCount = inspect.State.RestartCount
		}

		snapshot := apiclient.ContainerSnapshot{
			DockerId:  cnt.ID,
			Name:      name,
			Image:     cnt.Image,
			ImageId:   cnt.ImageID,
			Command:   cnt.Command,
			State:     cnt.State,
			Status:    cnt.Status,
			RestartCount: restartCount,
			Ports:     ports,
			Labels:    labels,
			Networks:  networks,
			Volumes:   volumes,
			CreatedAt: createdAt,
			StartedAt: startedAt,
		}

		snapshots = append(snapshots, snapshot)
	}

	return snapshots, nil
}

func (c *Client) GetHostSnapshot(ctx context.Context) (*apiclient.HostSnapshot, error) {
	info, err := c.dockerCli.Info(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get docker info for host snapshot: %w", err)
	}

	ipAddress := ""
	if info.Swarm.NodeAddr != "" {
		ipAddress = info.Swarm.NodeAddr
	}

	return &apiclient.HostSnapshot{
		IPAddress:        ipAddress,
		CpuCount:         info.NCPU,
		MemoryTotalBytes: int64(info.MemTotal),
	}, nil
}

func stringPtr(value string) *string {
	return &value
}

func (c *Client) GetContainerStats(ctx context.Context, containerID string) (*apiclient.MetricItem, error) {
	stats, err := c.dockerCli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}
	defer stats.Body.Close()

	var v types.StatsJSON
	if err := json.NewDecoder(stats.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("failed to decode stats: %w", err)
	}

	// Calculate CPU usage percent
	cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage) - float64(v.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(v.CPUStats.SystemUsage) - float64(v.PreCPUStats.SystemUsage)
	cpuUsage := 0.0
	if systemDelta > 0.0 && cpuDelta > 0.0 {
		cpuUsage = (cpuDelta / systemDelta) * float64(len(v.CPUStats.CPUUsage.PercpuUsage)) * 100.0
	}

	// Calculate memory usage
	memUsage := v.MemoryStats.Usage - v.MemoryStats.Stats["cache"]

	// Calculate network I/O
	var rx, tx uint64
	for _, network := range v.Networks {
		rx += network.RxBytes
		tx += network.TxBytes
	}

	return &apiclient.MetricItem{
		ContainerId:      containerID,
		CpuUsagePercent:  cpuUsage,
		MemoryUsageBytes: int64(memUsage),
		NetworkRxBytes:   int64(rx),
		NetworkTxBytes:   int64(tx),
	}, nil
}

func (c *Client) StreamContainerLogs(ctx context.Context, containerID string, logChan chan<- apiclient.LogItem) error {
	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "50",
	}

	logs, err := c.dockerCli.ContainerLogs(ctx, containerID, options)
	if err != nil {
		return fmt.Errorf("failed to attach logs: %w", err)
	}
	defer logs.Close()

	// Docker log streams are multiplexed. The first 8 bytes of each frame contain the stream type and size.
	hdr := make([]byte, 8)
	for {
		_, err := io.ReadFull(logs, hdr)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		streamType := "stdout"
		if hdr[0] == 2 {
			streamType = "stderr"
		}

		count := binary.BigEndian.Uint32(hdr[4:8])
		dat := make([]byte, count)
		_, err = io.ReadFull(logs, dat)
		if err != nil {
			return err
		}

		logChan <- apiclient.LogItem{
			ContainerId: containerID,
			Stream:      streamType,
			Message:     strings.TrimSuffix(string(dat), "\n"),
		}
	}
}

func (c *Client) StartContainer(ctx context.Context, containerID string) error {
	return c.dockerCli.ContainerStart(ctx, containerID, types.ContainerStartOptions{})
}

func (c *Client) StopContainer(ctx context.Context, containerID string) error {
	timeout := 10 // 10 seconds before kill
	return c.dockerCli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
}

func (c *Client) RestartContainer(ctx context.Context, containerID string) error {
	timeout := 10
	return c.dockerCli.ContainerRestart(ctx, containerID, container.StopOptions{Timeout: &timeout})
}
