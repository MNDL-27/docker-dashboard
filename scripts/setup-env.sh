#!/bin/bash
# Environment setup script for Docker Dashboard local development
# Run this script to generate the .env file with secure random values

set -e

# Configuration
ENV_FILE=".env"
DB_USER="app"
DB_NAME="docker_dashboard"

# Generate secure random values
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32
    elif command -v node &> /dev/null; then
        node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    else
        echo "Error: Neither openssl nor node is available to generate secrets"
        exit 1
    fi
}

# Check if .env already exists
if [ -f "$ENV_FILE" ]; then
    read -p "$ENV_FILE already exists. Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted. Existing .env preserved."
        exit 0
    fi
fi

# Generate secrets
DB_PASSWORD=$(generate_secret)
SESSION_SECRET=$(generate_secret)
JWT_SECRET=$(generate_secret)
REDIS_PASSWORD=$(generate_secret)

# AWS credentials for LocalStack
AWS_ACCESS_KEY_ID="test"
AWS_SECRET_ACCESS_KEY="test"
AWS_REGION="us-east-1"

# Create .env file
cat > "$ENV_FILE" << EOF
# Database
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public

# Session
SESSION_SECRET=$SESSION_SECRET

# JWT
JWT_SECRET=$JWT_SECRET

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=$REDIS_PASSWORD

# AWS / LocalStack
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_REGION=$AWS_REGION
LOCALSTACK_URL=http://localhost:4566

# Node environment
NODE_ENV=development
EOF

echo "=========================================="
echo "  Environment setup complete!"
echo "=========================================="
echo ""
echo "Created: $ENV_FILE"
echo ""
echo "To start the local development environment:"
echo "  1. Ensure Docker is running"
echo "  2. Run: docker compose -f docker-compose.base.yml up -d"
echo "  3. Run: docker compose -f docker-compose.dev.yml up --build"
echo ""
echo "Or use the convenience script:"
echo "  ./start-dev.sh"
echo ""
