# Agent Dockerfile
# Multi-stage build for Go agent

# Build stage
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /build

# Copy go mod files
COPY go.* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the agent binary
RUN CGO_ENABLED=0 GOOS=linux go build -o agent -ldflags="-s -w" ./cmd/agent

# Runtime stage
FROM alpine:3.19

# Install CA certificates and runtime dependencies
RUN apk add --no-cache ca-certificates dumb-init

# Create non-root user
RUN adduser -D -u 1000 agent

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/agent .
COPY --from=builder /build/config ./config

# Set ownership
RUN chown -R agent:agent /app

# Switch to non-root user
USER agent

# Expose agent port
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the agent
CMD ["./agent", "-config", "./config/dev.yaml"]
