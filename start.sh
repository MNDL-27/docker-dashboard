#!/bin/bash

# Docker Dashboard Quick Start Script
# Works with both docker-compose and docker compose (V2)

set -e

echo "🐳 Docker Dashboard - Quick Start"
echo "=================================="
echo ""

# Check if docker-compose.yml exists, if not copy from example
if [ ! -f "docker-compose.yml" ]; then
    if [ -f "docker-compose.example.yml" ]; then
        echo "📋 Copying docker-compose.example.yml to docker-compose.yml..."
        cp docker-compose.example.yml docker-compose.yml
        echo "✓ Created docker-compose.yml"
        echo ""
    else
        echo "❌ Error: docker-compose.example.yml not found!"
        exit 1
    fi
fi

# Detect Docker Compose command
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ Error: Docker Compose not found!"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Using: $COMPOSE_CMD"
echo ""

# Function to display menu
show_menu() {
    echo "Choose an option:"
    echo "  1) Start Dashboard (build & run)"
    echo "  2) Start Dashboard (use existing image)"
    echo "  3) Stop Dashboard"
    echo "  4) View Logs"
    echo "  5) Restart Dashboard"
    echo "  6) Rebuild & Restart"
    echo "  7) Remove Everything (cleanup)"
    echo "  0) Exit"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice [0-7]: " choice
    echo ""

    case $choice in
        1)
            echo "🔨 Building and starting dashboard..."
            $COMPOSE_CMD up -d --build
            echo ""
            echo "✅ Dashboard started!"
            echo "🌐 Open: http://localhost:1714"
            ;;
        2)
            echo "🚀 Starting dashboard..."
            $COMPOSE_CMD up -d
            echo ""
            echo "✅ Dashboard started!"
            echo "🌐 Open: http://localhost:1714"
            ;;
        3)
            echo "🛑 Stopping dashboard..."
            $COMPOSE_CMD down
            echo "✅ Dashboard stopped!"
            ;;
        4)
            echo "📋 Showing logs (Ctrl+C to exit)..."
            $COMPOSE_CMD logs -f dashboard
            ;;
        5)
            echo "🔄 Restarting dashboard..."
            $COMPOSE_CMD restart
            echo "✅ Dashboard restarted!"
            ;;
        6)
            echo "🔨 Rebuilding and restarting..."
            $COMPOSE_CMD down
            $COMPOSE_CMD up -d --build
            echo ""
            echo "✅ Dashboard rebuilt and started!"
            echo "🌐 Open: http://localhost:1714"
            ;;
        7)
            echo "⚠️  This will remove containers, networks, and volumes!"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                $COMPOSE_CMD down -v
                echo "✅ Cleanup complete!"
            else
                echo "Cancelled."
            fi
            ;;
        0)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please try again."
            ;;
    esac
    echo ""
done
