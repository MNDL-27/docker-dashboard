import { createHash, randomBytes } from 'node:crypto';

const DEFAULT_TOKEN_TTL_MINUTES = 15;

interface HostTokenCreateClient {
  hostToken: {
    create: (args: {
      data: {
        tokenHash: string;
        organizationId: string;
        projectId: string;
        createdBy: string;
        expiresAt: Date;
      };
      select: {
        id: true;
        expiresAt: true;
      };
    }) => Promise<{ id: string; expiresAt: Date }>;
  };
}

export interface IssueEnrollmentTokenInput {
  organizationId: string;
  projectId: string;
  createdBy: string;
}

export interface IssuedEnrollmentToken {
  id: string;
  token: string;
  expiresAt: Date;
}

export function hashEnrollmentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateEnrollmentToken(): string {
  return randomBytes(32).toString('base64url');
}

function resolveEnrollmentTokenTtlMinutes(): number {
  const rawValue = process.env.HOST_ENROLLMENT_TOKEN_TTL_MINUTES;
  if (!rawValue) {
    return DEFAULT_TOKEN_TTL_MINUTES;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TOKEN_TTL_MINUTES;
  }

  return parsed;
}

export async function issueEnrollmentToken(
  db: HostTokenCreateClient,
  input: IssueEnrollmentTokenInput
): Promise<IssuedEnrollmentToken> {
  const token = generateEnrollmentToken();
  const tokenHash = hashEnrollmentToken(token);

  const expiresAt = new Date(Date.now() + resolveEnrollmentTokenTtlMinutes() * 60_000);

  const createdToken = await db.hostToken.create({
    data: {
      tokenHash,
      organizationId: input.organizationId,
      projectId: input.projectId,
      createdBy: input.createdBy,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return {
    id: createdToken.id,
    token,
    expiresAt: createdToken.expiresAt,
  };
}

export function buildEnrollmentInstallCommand(apiUrl: string, token: string): string {
  return `docker run -d --name docker-dashboard-agent \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -e AGENT_API_URL="${apiUrl}" \\
  -e AGENT_TOKEN="${token}" \\
  docker-dashboard-agent:latest`;
}
