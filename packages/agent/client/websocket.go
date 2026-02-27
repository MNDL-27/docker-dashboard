package client

import (
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type AgentWSClient struct {
	BaseURL string
	Token   string
	Conn    *websocket.Conn
	SendCh  chan interface{}
}

func NewAgentWSClient(baseURL, token string) *AgentWSClient {
	wsURL := strings.Replace(baseURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	
	return &AgentWSClient{
		BaseURL: wsURL,
		Token:   token,
		SendCh:  make(chan interface{}, 100),
	}
}

func (c *AgentWSClient) Connect() error {
	u, err := url.Parse(fmt.Sprintf("%s/ws/agent", c.BaseURL))
	if err != nil {
		return err
	}
	
	q := u.Query()
	q.Set("token", c.Token)
	u.RawQuery = q.Encode()

	log.Printf("Connecting to WebSocket: %s", u.String())
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		return err
	}

	c.Conn = conn

	// Start write loop
	go c.writeLoop()

	// Start read loop (for actions, ping/pong, to be expanded in Plan 06)
	go c.readLoop()

	return nil
}

func (c *AgentWSClient) writeLoop() {
	defer c.Conn.Close()
	for msg := range c.SendCh {
		c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		err := c.Conn.WriteJSON(msg)
		if err != nil {
			log.Printf("WebSocket write error: %v", err)
			return // Exits and closes connection, standard retry logic would reconnect
		}
	}
}

func (c *AgentWSClient) readLoop() {
	defer c.Conn.Close()
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}
		// Messages from cloud ignored for now (Will handle Actions later)
	}
}

type MetricPayload struct {
	Type     string      `json:"type"`
	HostId   string      `json:"hostId"`
	Metrics  []MetricItem `json:"metrics"`
}

type MetricItem struct {
	ContainerId      string  `json:"containerId"`
	CpuUsagePercent  float64 `json:"cpuUsagePercent"`
	MemoryUsageBytes int64   `json:"memoryUsageBytes"`
	NetworkRxBytes   int64   `json:"networkRxBytes"`
	NetworkTxBytes   int64   `json:"networkTxBytes"`
}

type LogPayload struct {
	Type   string    `json:"type"`
	HostId string    `json:"hostId"`
	Logs   []LogItem `json:"logs"`
}

type LogItem struct {
	ContainerId string `json:"containerId"`
	Stream      string `json:"stream"` // "stdout" or "stderr"
	Message     string `json:"message"`
}

func (c *AgentWSClient) SendMetrics(hostId string, metrics []MetricItem) {
	c.SendCh <- MetricPayload{
		Type:    "metrics",
		HostId:  hostId,
		Metrics: metrics,
	}
}

func (c *AgentWSClient) SendLogs(hostId string, logs []LogItem) {
	c.SendCh <- LogPayload{
		Type:   "logs",
		HostId: hostId,
		Logs:   logs,
	}
}
