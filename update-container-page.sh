#!/bin/bash
# Apply Dark Theme to Container Details Page

echo "🎨 Updating container details page to dark theme..."

cd ~/software/docker-dashboard

# Pull latest changes
git pull

# Restart container to see changes  
docker compose down
docker compose up -d

echo "✅ Dark theme applied to container details page!"
echo "📊 Bandwidth tracking is already included!"
echo ""
echo "Features:"
echo "  ✓ Dark navy/slate background"
echo "  ✓ Clean card design"
echo "  ✓ CPU, Memory, Network I/O stats"
echo "  ✓ Total Bandwidth Usage (Download/Upload/Combined)"
echo "  ✓ Real-time charts"
echo "  ✓ Live logs"
echo ""
echo "Access: http://your-server-ip:1714"
