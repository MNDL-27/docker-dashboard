import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function run() {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  
  const hosts = await sql`SELECT id, name, status, last_seen_at, consecutive_failures, last_error FROM docker_hosts`;
  console.log('--- Hosts ---');
  console.table(hosts);

  const config = await sql`SELECT mode FROM mock_agent_config LIMIT 1`;
  console.log('--- Mock Agent Mode ---');
  console.table(config);
}
run();
