import type { Config } from '@netlify/functions';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    
    // Extract key details from the Sentry webhook payload
    const issueUrl = body.url || 'Unknown URL';
    const errorMessage = body.message || body.culprit || 'Unknown error';
    const project = body.project_name || 'dockerdash';

    // The GitHub Personal Access Token (PAT) must have repo permissions
    // Set this in your Netlify Environment Variables
    const githubToken = process.env.GITHUB_PAT;
    const githubRepo = process.env.GITHUB_REPO || 'MNDL-27/docker-watchtower-dash';

    if (!githubToken) {
      console.error("Missing GITHUB_PAT environment variable");
      return new Response('Configuration error: Missing GITHUB_PAT', { status: 500 });
    }

    // Trigger the GitHub Action repository_dispatch event
    const ghResponse = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'sentry_error', // This matches the types: [sentry_error] in the workflow
        client_payload: {
          error_message: errorMessage,
          issue_url: issueUrl,
          project: project
        }
      })
    });

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      throw new Error(`GitHub API responded with ${ghResponse.status}: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Dispatched to GitHub Actions' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("Sentry webhook processing failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: '/api/sentry-webhook',
};
