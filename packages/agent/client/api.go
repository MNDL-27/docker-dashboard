package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type APIClient struct {
	BaseURL    string
	AgentToken string
	HTTPClient *http.Client
}

func NewAPIClient(baseURL string, agentToken string) *APIClient {
	return &APIClient{
		BaseURL:    baseURL,
		AgentToken: agentToken,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type EnrollRequest struct {
	Token         string `json:"token"`
	Name          string `json:"name"`
	Hostname      string `json:"hostname"`
	OS            string `json:"os"`
	Architecture  string `json:"architecture"`
	DockerVersion string `json:"dockerVersion"`
}

type EnrollResponse struct {
	AgentToken     string `json:"agentToken"`
	HostId         string `json:"hostId"`
	OrganizationId string `json:"organizationId"`
}

func (c *APIClient) Enroll(reqData EnrollRequest) (*EnrollResponse, error) {
	url := fmt.Sprintf("%s/api/agent/enroll", c.BaseURL)
	
	bodyData, err := json.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal enroll request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("enroll request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("enroll request failed with status: %d", resp.StatusCode)
	}

	var enrollResp EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&enrollResp); err != nil {
		return nil, fmt.Errorf("failed to decode enroll response: %w", err)
	}

	// Update the client's token for future requests
	c.AgentToken = enrollResp.AgentToken
	return &enrollResp, nil
}

func (c *APIClient) Heartbeat() error {
	if c.AgentToken == "" {
		return fmt.Errorf("agent token is required for heartbeat")
	}

	url := fmt.Sprintf("%s/api/agent/heartbeat", c.BaseURL)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AgentToken))

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("heartbeat request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("heartbeat request failed with status: %d", resp.StatusCode)
	}

	return nil
}

type ContainerSnapshot struct {
	DockerId  string                 `json:"dockerId"`
	Name      string                 `json:"name"`
	Image     string                 `json:"image"`
	ImageId   string                 `json:"imageId"`
	Command   string                 `json:"command"`
	State     string                 `json:"state"`
	Status    string                 `json:"status"`
	Ports     map[string]interface{} `json:"ports"`
	Labels    map[string]interface{} `json:"labels"`
	StartedAt *string                `json:"startedAt,omitempty"`
}

func (c *APIClient) SyncContainers(containers []ContainerSnapshot) error {
	if c.AgentToken == "" {
		return fmt.Errorf("agent token is required for sync")
	}

	url := fmt.Sprintf("%s/api/agent/containers", c.BaseURL)
	
	bodyData, err := json.Marshal(containers)
	if err != nil {
		return fmt.Errorf("failed to marshal containers: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AgentToken))

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("sync containers request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("sync containers request failed with status: %d", resp.StatusCode)
	}

	return nil
}
