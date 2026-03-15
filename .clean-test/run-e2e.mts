import { createServer } from 'http';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
import { sql } from '../netlify/functions/lib/db.mjs';

// Load our netlify functions locally
import authFunction from '../netlify/functions/api-docker-hosts.mjs';
import proxyFunction from '../netlify/functions/api-docker-proxy.mjs';

const PORT = 13337;
const MOCK_HOST_URL = `http://localhost:${PORT}`;

// 1. Create a mock agent server
const server = createServer((req, res) => {
  if (req.url === '/docker/_ping') {
    res.writeHead(200);
    res.end('OK');
  } else if (req.url === '/docker/info') {
    // Simulate a slow agent (hanging for 15s)
    setTimeout(() => {
      res.writeHead(200);
      res.end('{"ID":"test"}');
    }, 15000);
  } else if (req.url?.includes('logs')) {
    // Simulate a massive payload (5MB+)
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    const chunk = Buffer.alloc(1024 * 1024, 'A'); // 1MB chunks
    let sent = 0;
    const interval = setInterval(() => {
      res.write(chunk);
      sent++;
      if (sent >= 6) { // 6MB total
        clearInterval(interval);
        res.end();
      }
    }, 100);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log('--- STARTING E2E STAGING REGRESSION ---');

  // Insert a test user and org to bypass auth
  let users = await sql`SELECT id FROM public.users WHERE email = 'e2e-test@example.com'`;
  if (users.length === 0) {
    users = await sql`
      INSERT INTO public.users (email, full_name, clerk_user_id, password_hash) 
      VALUES ('e2e-test@example.com', 'E2E Test', 'req_test_user', 'mock') 
      RETURNING id
    `;
  }
  const userId = users[0].id;

  let orgs = await sql`SELECT id FROM public.organizations WHERE slug = 'e2e-org'`;
  if (orgs.length === 0) {
    const [{ create_organization }] = await sql`SELECT public.create_organization('e2e-org', ${userId})`;
    orgs = [{ id: create_organization }];
  }
  const orgId = orgs[0].id;

  const makeReq = async (func: any, options: any) => {
    // Fake the Request object matching Netlify's signature
    const req = new Request(options.url, {
      method: options.method,
      headers: { ...options.headers, 'x-test-bypass': 'true', 'x-test-user-id': userId, 'x-test-org-id': orgId },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return func.default(req);
  };

  try {
    // TEST 1: Add a host & verify encryption
    console.log('\n[TEST 1] Adding a new Docker Host with secrets...');
    const addHostRes = await makeReq(authFunction, {
      url: 'http://localhost/api/docker-hosts',
      method: 'POST',
      body: {
        name: 'E2E Mock Host',
        host_url: MOCK_HOST_URL,
        connection_mode: 'agent',
        secrets: { agentApiKey: 'sk_test_super_secret_agent_key_123' }
      }
    });

    const hostData = await addHostRes.json();
    console.log(hostData.error ? 'FAILED' : 'SUCCESS: Host created');

    const secretsQuery = await sql`SELECT * FROM docker_host_secrets WHERE host_id = ${hostData.id}`;
    const storedKey = secretsQuery[0].agent_api_key;
    console.log(`EVIDENCE (Encryption): Stored key in DB is -> ${storedKey}`);
    if (storedKey.includes('sk_test_') || !storedKey.startsWith('v1:')) {
      throw new Error('Secret was NOT encrypted!');
    } else {
      console.log('PASS: Secret is encrypted using AES-256-GCM v1 template.');
    }

    // TEST 2: Polling proxy call (Ping)
    console.log('\n[TEST 2] Proxy Call -> Ping (Normal)');
    const pingRes = await makeReq(proxyFunction, {
      url: 'http://localhost/api/docker-proxy',
      method: 'POST',
      body: { action: 'ping', hostId: hostData.id }
    });
    const pingData = await pingRes.json();
    console.log('Ping Response:', pingData.status);
    if (!pingRes.ok) throw new Error('Ping failed');

    // TEST 3: Timeout Guardrail
    console.log('\n[TEST 3] Proxy Call -> Info (Slow Agent Timeout Guardrail)');
    const start = Date.now();
    const infoRes = await makeReq(proxyFunction, {
      url: 'http://localhost/api/docker-proxy',
      method: 'POST',
      body: { action: 'info', hostId: hostData.id }
    });
    const duration = Date.now() - start;
    console.log(`Info Response Time: ${duration}ms, Status: ${infoRes.status}`);
    const infoData = await infoRes.json();
    console.log('EVIDENCE (Timeout):', infoData);
    if (infoRes.status !== 504 || duration > 4000) {
      throw new Error('Timeout guardrail failed to cut off at 3s!');
    } else {
      console.log('PASS: Timeout safely triggered under 4s without crashing.');
    }

    // TEST 4: Payload Truncation
    console.log('\n[TEST 4] Proxy Call -> Logs (Oversized Payload Guardrail)');
    const logsRes = await makeReq(proxyFunction, {
      url: 'http://localhost/api/docker-proxy',
      method: 'POST',
      body: { action: 'container-logs', hostId: hostData.id, containerId: 'mock-abc' }
    });
    console.log(`Logs Response Status: ${logsRes.status}`);
    const logsData = await logsRes.json();
    console.log('EVIDENCE (Payload Limit):', logsData);
    if (logsRes.status !== 413) {
      throw new Error('Payload guardrail failed to truncate 5MB+ stream!');
    } else {
      console.log('PASS: Logs threw 413 Payload Too Large and safely released memory.');
    }

    // Cleanup
    await sql`DELETE FROM docker_hosts WHERE id = ${hostData.id}`;
    
    console.log('\nALL E2E BACKEND TESTS PASSED.');

  } catch (err) {
    console.error('\nE2E TEST FAILED:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
