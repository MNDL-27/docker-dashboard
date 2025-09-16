
````markdown
<div align="center">
  <h1>🚢 Docker Dashboard</h1>
  <p>A modern web app to monitor, manage, and view live stats/logs for all your Docker containers.<br>
  <b>Node.js backend + SPA frontend + Portainer gateway support</b></p>
  <p>
    <img src="https://img.shields.io/github/license/MNDL-27/docker-dashboard?style=flat-square" alt="License">
    <img src="https://img.shields.io/github/languages/top/MNDL-27/docker-dashboard?style=flat-square" alt="Top Language">
    <img src="https://img.shields.io/github/last-commit/MNDL-27/docker-dashboard?style=flat-square" alt="Last Commit">
  </p>
</div>

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone [https://github.com/MNDL-27/docker-dashboard.git](https://github.com/MNDL-27/docker-dashboard.git)
cd docker-dashboard
````

### 2\. Configure your environment

```bash
cp .env.example .env
```

Now, open the `.env` file and edit the variables to match your setup.

### 3\. Run with Docker Compose

```bash
docker compose up -d
```

### 4\. Access the Dashboard

Once the containers are running, you can access the dashboard in your browser:

  * **Modern UI:** [http://localhost:8088](https://www.google.com/search?q=http://localhost:8088)
  * **Backend API:** [http://localhost:1713/api/containers](https://www.google.com/search?q=http://localhost:1713/api/containers)

-----

## ⚙️ Configuration

You can customize the application by editing the `.env` file:

```env
# Set to true to use Portainer as a gateway
USE_PORTAINER=false

# The port to expose the dashboard on
PORT=8088

# The path to the Docker socket
DOCKER_SOCKET=/var/run/docker.sock

# --- Portainer Gateway Settings ---
# (Only used if USE_PORTAINER is set to true)

# The URL of your Portainer instance
PORTAINER_URL=[https://portainer.example.com:9443](https://portainer.example.com:9443)

# The ID of the Portainer endpoint you want to connect to
PORTAINER_ENDPOINT_ID=1

# Your Portainer API key
PORTAINER_API_KEY=replace_me
```

-----

## 🛡️ Security Notes

> **Important:** Please take a moment to review these security recommendations.

  * **API Keys:** Keep your Portainer API key a secret. Do not commit your `.env` file with your actual keys to version control.
  * **Socket Access:** Only mount the Docker socket for trusted users. Granting access to the Docker socket is equivalent to giving root access to your host.
  * **HTTPS:** Always use HTTPS for both the dashboard and your Portainer instance in a production environment.
  * **Authentication:** This application does not have built-in authentication. If you plan to expose the dashboard publicly, it is strongly recommended to add an authentication layer using a reverse proxy (like Nginx or Traefik) or other middleware.

-----

## 🔗 Portainer Gateway

You can use a Portainer instance as a gateway to manage multiple Docker hosts and leverage Portainer's Role-Based Access Control (RBAC).

### How to set it up:

1.  Set up a Portainer instance and create an API key.
2.  In your `.env` file, set `USE_PORTAINER=true`.
3.  Fill in the `PORTAINER_URL`, `PORTAINER_ENDPOINT_ID`, and `PORTAINER_API_KEY` variables.
4.  Restart the dashboard: `docker compose up -d --force-recreate`

All API calls will now be routed through your Portainer instance.

-----

## ⚠️ Limitations

  * **No Built-in Authentication:** As mentioned in the security notes, you should add your own authentication for public-facing deployments.
  * **Stats/Logs Streaming:** The real-time stats and logs streaming is a best-effort implementation and may require tuning for large-scale clusters.
  * **Portainer Gateway:** Requires a valid API key and endpoint ID to function correctly.

-----

## 🙌 Contributing

We welcome contributions\! Please see our [CONTRIBUTING.md](https://www.google.com/search?q=CONTRIBUTING.md) file for guidelines on how to get started.

-----

## 📄 License

This project is licensed under the AGPL-3.0 License. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.

```
```
