# Dockerdash installer hash mismatch

- Symptom: agent install/update command fails SHA256 verification with a stable, different hash.
- Root cause: UI/server expected hash out of sync with actual installer file served at app.dockerdash.app.
- Fix: update `shared/watchtower-agent-release.ts` installer SHA256 to match the deployed installer file hash, then redeploy.
- Quick check: compare `Get-FileHash public/watchtower-agent-install.sh` with the hash shown in the UI command.
