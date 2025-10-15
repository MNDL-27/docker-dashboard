# Contributing to Docker Dashboard

Thank you for considering contributing to Docker Dashboard! 🎉

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)

## 🤝 Code of Conduct

This project follows a simple code of conduct:
- Be respectful and constructive
- Help others learn and grow
- Focus on what's best for the community
- Show empathy towards other contributors

## 💡 How Can I Contribute?

### Reporting Bugs
- Check if the bug has already been reported in [Issues](https://github.com/MNDL-27/docker-dashboard/issues)
- Use the bug report template
- Provide detailed steps to reproduce
- Include screenshots if applicable
- Specify your environment (OS, Docker version, browser)

### Suggesting Features
- Check if the feature has already been suggested
- Use the feature request template
- Explain why this feature would be useful
- Provide examples or mockups if possible

### Contributing Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🛠️ Development Setup

### Prerequisites
- Docker 20.10+
- Docker Compose v2+
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/MNDL-27/docker-dashboard.git
   cd docker-dashboard
   ```

2. **Copy the example compose file**
   ```bash
   cp docker-compose.example.yml docker-compose.yml
   ```

3. **Start the dashboard**
   ```bash
   docker compose up
   ```

4. **Access the dashboard**
   - Open http://localhost:1714
   - Make changes to code in `server/` or `public/`
   - Restart container to see changes: `docker compose restart`

### Project Structure
```
docker-dashboard/
├── server/           # Backend Node.js code
│   ├── index.js     # Main server file
│   ├── routes/      # API routes
│   ├── middleware/  # Express middleware
│   ├── sockets/     # WebSocket handlers
│   └── docker/      # Docker API clients
├── public/          # Frontend HTML/CSS/JS
│   ├── index.html   # Main dashboard
│   ├── container.html  # Container details
│   └── app.js       # Frontend logic
├── wiki/            # Documentation
└── docker-compose.example.yml
```

## 🔄 Pull Request Process

1. **Update Documentation**
   - Update README.md if you change functionality
   - Update wiki docs if needed
   - Add comments to complex code

2. **Test Your Changes**
   - Test in Docker container (not just locally)
   - Test with auth enabled and disabled
   - Check all affected pages
   - Verify no console errors

3. **Follow Code Style**
   - Use consistent indentation (2 spaces)
   - Use meaningful variable names
   - Keep functions small and focused
   - Add comments for complex logic

4. **Write Clear Commit Messages**
   ```
   feat: add dark mode toggle
   fix: container stats not updating
   docs: update installation guide
   refactor: simplify auth middleware
   ```

5. **Fill Out PR Template**
   - Describe what you changed and why
   - Link related issues
   - Add screenshots for UI changes
   - Check all boxes in the checklist

6. **Wait for Review**
   - Be patient - reviews may take a few days
   - Address feedback constructively
   - Keep your branch up to date with main

## 🎨 Style Guidelines

### JavaScript
```javascript
// ✅ Good
async function fetchContainers() {
  try {
    const response = await fetch('/api/containers');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch containers:', error);
    return [];
  }
}

// ❌ Bad
function fetchContainers(){
return fetch('/api/containers').then(r=>r.json())
}
```

### HTML
```html
<!-- ✅ Good -->
<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold">Dashboard</h1>
</div>

<!-- ❌ Bad -->
<div class=container><h1>Dashboard</h1></div>
```

### Git Commits
```bash
# ✅ Good
git commit -m "feat: add real-time CPU usage chart"
git commit -m "fix: resolve memory leak in stats polling"

# ❌ Bad
git commit -m "updates"
git commit -m "fix stuff"
```

## 🐛 Debugging Tips

### Check Container Logs
```bash
docker compose logs -f
```

### Access Container Shell
```bash
docker exec -it docker-dashboard sh
```

### Restart Container
```bash
docker compose restart
```

### Rebuild After Changes
```bash
docker compose up --build
```

## 📝 Commit Message Guidelines

Use conventional commits format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add logout button to dashboard
fix: rate limiter validation error
docs: update quick start guide
refactor: simplify docker client code
```

## ❓ Questions?

- Open an issue with the "question" label
- Check existing issues and discussions
- Review the [wiki documentation](wiki/Home.md)

## 🙏 Thank You!

Every contribution helps make Docker Dashboard better for everyone. We appreciate your time and effort! ✨

---

**Happy Contributing!** 🚀
