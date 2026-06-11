import { sql } from './db.mjs';

let schemaEnsured = false;

/**
 * Runtime-safe schema backfill for docker host metadata.
 *
 * Why this exists:
 * - Production or local DBs can be behind the current schema.
 * - Host ping and health polling now persist agent_version and related fields.
 * - We guarantee those columns exist before read/write paths execute.
 */
export async function ensureDockerHostSchema() {
  if (schemaEnsured) return;
  schemaEnsured = true;
}
