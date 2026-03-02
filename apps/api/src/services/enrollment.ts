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

interface EnrollmentConsumeClient {
  hostToken: {
    updateMany: (args: {
      where: {
        tokenHash: string;
        usedAt: null;
        expiresAt: { gt: Date };
      };
      data: {
        usedAt: Date;
      };
    }) => Promise<{ count: number }>;
    findUnique: (args: {
      where: {
        tokenHash: string;
      };
      select: {
        organizationId: true;
        projectId: true;
      };
    }) => Promise<{ organizationId: string; projectId: string } | null>;
  };
  host: {
    create: (args: {
      data: {
        organizationId: string;
        projectId: string;
        name: string;
        hostname: string;
        os: string;
        architecture: string;
        dockerVersion: string;
        lastSeen: Date;
        status: 'ONLINE';
      };
      select: {
        id: true;
        organizationId: true;
        projectId: true;
      };
    }) => Promise<{ id: string; organizationId: string; projectId: string }>;
  };
}

interface EnrollmentTransactionClient {
  $transaction: <T>(operation: (tx: EnrollmentConsumeClient) => Promise<T>) => Promise<T>;
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

export interface ConsumeEnrollmentTokenInput {
  token: string;
  name: string;
  hostname: string;
  os: string;
  architecture: string;
  dockerVersion: string;
}

export interface EnrolledHostCredentialScope {
  hostId: string;
  organizationId: string;
  projectId: string;
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

export async function consumeEnrollmentToken(
  db: EnrollmentTransactionClient,
  input: ConsumeEnrollmentTokenInput
): Promise<EnrolledHostCredentialScope | null> {
  const tokenHash = hashEnrollmentToken(input.token);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const consumed = await tx.hostToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      return null;
    }

    const consumedToken = await tx.hostToken.findUnique({
      where: { tokenHash },
      select: {
        organizationId: true,
        projectId: true,
      },
    });

    if (!consumedToken) {
      return null;
    }

    const host = await tx.host.create({
      data: {
        organizationId: consumedToken.organizationId,
        projectId: consumedToken.projectId,
        name: input.name,
        hostname: input.hostname,
        os: input.os,
        architecture: input.architecture,
        dockerVersion: input.dockerVersion,
        lastSeen: now,
        status: 'ONLINE',
      },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
      },
    });

    return {
      hostId: host.id,
      organizationId: host.organizationId,
      projectId: host.projectId,
    };
  });
}

export function buildEnrollmentInstallCommand(apiUrl: string, token: string): string {
  return `docker run -d --name docker-dashboard-agent \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -e AGENT_API_URL="${apiUrl}" \\
  -e AGENT_TOKEN="${token}" \\
  docker-dashboard-agent:latest`;
}
