# GitHub Pages Configuration

This folder contains the static GitHub Pages site for Docker Dashboard.

## Note

Docker Dashboard is a **server-side application** that requires Docker to run.
This GitHub Pages site is for documentation and screenshots only.

To use Docker Dashboard, install it on your Docker host following the instructions in the [main README](../README.md).

## Local Preview

To preview the GitHub Pages site locally:

```bash
cd docs
python -m http.server 8000
# Visit http://localhost:8000
```

## Deployment

GitHub Pages automatically deploys from the `docs` folder on the `main` branch.
Any changes pushed to this folder will be reflected on https://mndl-27.github.io/docker-dashboard/
