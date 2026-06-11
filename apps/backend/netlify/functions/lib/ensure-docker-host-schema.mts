import { sql } from './db.mjs';

let schemaEnsured = false;

export async function ensureDockerHostSchema() {
  if (schemaEnsured) return;
  schemaEnsured = true;

  await sql`
  CREATE TABLE IF NOT EXISTS host_metrics_cache (
    id BIGSERIAL PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES docker_hosts(id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cpu DOUBLE PRECISION NOT NULL DEFAULT 0,
    memory DOUBLE PRECISION NOT NULL DEFAULT 0,
    used_cores INTEGER NOT NULL DEFAULT 0,
    total_cores INTEGER NOT NULL DEFAULT 0,
    memory_used BIGINT NOT NULL DEFAULT 0,
    memory_limit BIGINT NOT NULL DEFAULT 0,
    network_in_bytes_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
    network_out_bytes_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
    network_monthly_total BIGINT NOT NULL DEFAULT 0,
    disk_read_bytes_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
    disk_write_bytes_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
    uptime_seconds BIGINT NOT NULL DEFAULT 0,
    disks JSONB NOT NULL DEFAULT '[]'::jsonb
  );

  CREATE INDEX IF NOT EXISTS idx_host_metrics_cache_host_collected
    ON host_metrics_cache (host_id, collected_at DESC);

  CREATE TABLE IF NOT EXISTS container_list_cache (
    host_id TEXT PRIMARY KEY REFERENCES docker_hosts(id) ON DELETE CASCADE,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    containers JSONB NOT NULL DEFAULT '[]'::jsonb
  );
  `;
}
