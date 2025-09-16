# Docker Dashboard

A modern, responsive Docker container monitoring dashboard with real-time stats and logs. This is a React-based implementation that provides a clean, dark-themed interface for monitoring Docker containers.

## Features

- **Real-time monitoring**: Live container stats (CPU, memory) via WebSocket
- **Live logs**: Real-time log streaming with auto-scroll functionality
- **Responsive design**: Mobile-first responsive layout
- **Dark theme**: Modern dark interface with status indicators
- **Configuration management**: Configurable API endpoints and refresh intervals
- **WebSocket status**: Visual indicators for connection status
- **Export/Import**: Configuration backup and restore

## Quick Start

1. Clone and install dependencies:
```bash
npm install
npm run dev
```

2. The dashboard expects a backend server providing these endpoints:
   - REST: `GET /api/containers` 
   - WebSocket: `/ws/stats?id=<containerId>`
   - WebSocket: `/ws/logs?id=<containerId>`

## Backend Integration

### Expected API Endpoints

#### GET /api/containers
Returns a JSON array of container objects. Each container should have at least:

```json
[
  {
    "Id": "1234567890abcdef...",
    "Names": ["/my-container"],
    "State": "running",
    "Status": "Up 2 hours"
  }
]
```

#### WebSocket: /ws/stats?id=<containerId>
- Send interval configuration: `{"type": "interval", "interval": 2000}`
- Receives JSON stats data:

```json
{
  "cpu_percent": 15.5,
  "memory_usage": 134217728,
  "memory_limit": 2147483648,
  "memory_percent": 6.25
}
```

#### WebSocket: /ws/logs?id=<containerId>
- Receives plain text log lines
- Dashboard keeps last 100 lines and auto-scrolls

### Integration with Express Backend

Drop the built files into your Express `public/` folder:

```
your-express-app/
├── public/
│   ├── index.html
│   ├── assets/
│   │   ├── index-[hash].js
│   │   └── index-[hash].css
│   └── ...other assets
├── app.js
└── package.json
```

Example Express setup:
```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static('public'));

// Your API routes
app.get('/api/containers', (req, res) => {
  // Your container logic
});

// WebSocket setup for /ws/stats and /ws/logs
// ... your WebSocket implementation

// Serve the dashboard for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

### Configuration Options

Access the config page at `/config` to set:

- **API Base URL**: Override the API endpoint (useful for path-prefix hosting)
- **Default Refresh Interval**: Set the default WebSocket stats update interval

Example config for path-prefix hosting:
```json
{
  "apiBase": "https://example.com/myapp",
  "defaultRefreshInterval": 2000
}
```

### WebSocket URL Construction

The dashboard automatically constructs WebSocket URLs by:
1. Taking the configured `apiBase` (or current origin if empty)
2. Replacing `http://` with `ws://` or `https://` with `wss://`
3. Preserving path prefixes for proper routing

### Local Testing

1. Start your backend server with the required endpoints
2. Build the React app: `npm run build`
3. Copy `dist/*` to your Express `public/` folder
4. Open your browser to the server URL
5. Check browser DevTools > Network > WS tab for WebSocket connections

### Development Mode

For development without a backend:
```bash
npm run dev
```

The app will show connection errors, which is expected without a proper backend.

## Status Indicators

- 🟢 **OPEN**: WebSocket connected and active
- 🟡 **CONNECTING**: Attempting to connect or reconnect
- 🔴 **ERROR**: Connection failed
- ⚫ **CLOSED**: Connection closed or not established

## Security Note

The configuration is stored in browser localStorage and should not contain secrets or API keys. This is only for connection settings like base URLs and refresh intervals.

## Browser Support

- Modern browsers with WebSocket support
- Mobile responsive (iOS Safari, Chrome Mobile)
- Keyboard navigation support for accessibility

## Architecture

- **React 18** with TypeScript
- **Tailwind CSS** for styling with custom design system
- **WebSocket** connections with automatic reconnection
- **LocalStorage** for configuration persistence
- **React Router** for navigation

## Customization

The design system is defined in `src/index.css` and `tailwind.config.ts`. All colors use HSL values and semantic tokens for easy customization.

Status colors:
- `--status-connected`: hsl(142 76% 36%)
- `--status-connecting`: hsl(43 96% 56%)  
- `--status-error`: hsl(0 84% 60%)
- `--status-closed`: hsl(215 15% 45%)`