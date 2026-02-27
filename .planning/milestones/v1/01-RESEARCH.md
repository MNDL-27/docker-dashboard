# Phase 1: Foundation & Identity - Research

**Researched:** 2026-02-27
**Domain:** Authentication, Multi-tenancy (Orgs/Projects), RBAC, Local Dev Environment
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure: user authentication via HTTP-only session cookies, multi-tenant organization/project structure with two-level RBAC (org + project roles), and a local development environment with PostgreSQL, Redis, and LocalStack.

**Primary recommendation:** Use express-session with connect-pg-simple for PostgreSQL-backed sessions, implement two-level RBAC at the application layer (not PostgreSQL roles), and use docker-compose base + override pattern with .env file generation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- HTTP-only session cookies (not JWT in localStorage)
- Auto-refresh tokens when access token expires
- Sessions persist for 7 days
- Logout only invalidates current device (not all sessions)
- Two-level: Org roles + Project roles (like GitHub org/repo)
- Project roles inherit from org roles by default
- Viewer role is read-only (no actions)
- Single owner for free tier, multiple owners for paid tier
- Free users: No org required, can add single host directly
- Paid users: Optional org (can choose org or single host)
- Base docker-compose + override files
- Base includes: PostgreSQL, Redis, LocalStack (S3)
- No seeded test user - users create their own account
- Setup script generates .env files

### Claude's Discretion
- Exact cookie security settings (Secure flag, SameSite)
- Database schema for sessions and tokens
- LocalStack configuration vs real S3
- Onboarding checklist UI/UX details

### Deferred Ideas (OUT OF SCOPE)
- Billing integration (Phase 5+)
- Multiple owner support for paid tier (Phase 5+)
- Team invitations workflow details
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IDTY-01 | User can sign up with email and password | express-session + bcrypt for password hashing |
| IDTY-02 | User can log in and stay logged in via JWT tokens | Session-based auth (HTTP-only cookies) - token stored server-side |
| IDTY-03 | User can create an Organization (tenant) | Multi-tenant schema with organizations table |
| IDTY-04 | User can create Projects within an Organization | Projects table with org_id foreign key |
| IDTY-05 | User can invite other users to Organization | Organization memberships with roles |
| IDTY-06 | User can have RBAC roles: Owner, Admin, Operator, Viewer | Two-level role system (org + project) |
| DEV-01 | Local dev environment via docker-compose.dev.yml | Base + override docker-compose pattern |
| DEV-02 | Postgres available in local dev | PostgreSQL 17.x in docker-compose |
| DEV-03 | Redis available in local dev | Redis 7.x in docker-compose |
| DEV-04 | cloud-api runs locally | Express API in apps/api |
| DEV-05 | cloud-web runs locally | Next.js 15 in apps/web |
| DEV-06 | Agent can run against local Docker | Agent service in packages/agent |
| DEV-07 | Seeded dev user for testing | NOTE: CONTEXT says NO seeded user |

Note: DEV-07 conflicts with CONTEXT.md which explicitly states "No seeded test user - users create their own account". This research supports CONTEXT.md decision.
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express-session | ^1.18.x | Session management | Official Express middleware, HTTP-only cookies |
| connect-pg-simple | ^10.x | PostgreSQL session store | Standard for persisting sessions in Postgres |
| pg | ^8.x | PostgreSQL client | Node.js PostgreSQL driver |
| bcrypt | ^5.1.x | Password hashing | Industry standard for password storage |
| Next.js | 15.x | Cloud UI | Industry standard for SaaS dashboards |
| Prisma | 6.x | ORM | Type-safe database access |
| zod | 3.x | Runtime validation | TypeScript-first validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express-rate-limit | ^7.x | Rate limiting | Already in package.json |
| cors | ^2.8.x | CORS | Already in package.json |
| pino | 10.x | Logging | Structured JSON logging |
| ws | 9.x | WebSocket | Agent communication |
| @tanstack/react-query | 5.x | Data fetching | Frontend state management |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| connect-pg-simple | redis | Redis faster but adds infrastructure; pg-simple sufficient |
| Prisma | Drizzle | Prisma better DX, Drizzle more control |
| bcrypt | argon2 | Argon2 winner of Password Hashing Competition, but bcrypt sufficient |

**Installation:**
```bash
npm install express-session connect-pg-simple pg bcrypt zod
npm install prisma --save-dev
npm install next@15 react@19 @tanstack/react-query
```

## Architecture Patterns

### Recommended Project Structure
```
docker-dashboard/
├── apps/
│   ├── api/              # Express API (cloud-api)
│   │   ├── src/
│   │   │   ├── routes/  # Auth, orgs, projects, RBAC
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   └── web/              # Next.js UI (cloud-web)
│       ├── src/
│       │   ├── app/      # App Router pages
│       │   ├── components/
│       │   └── lib/     # API clients
│       └── package.json
├── packages/
│   ├── agent/            # Go agent
│   └── shared/          # Shared types
├── prisma/
│   └── schema.prisma    # Database schema
├── docker-compose.yml   # Base config
├── docker-compose.override.yml  # Local dev overrides
└── .env.example         # Template for env vars
```

### Pattern 1: Session-Based Authentication with HTTP-Only Cookies

**What:** User credentials validated server-side, session stored in PostgreSQL, session ID in HTTP-only cookie

**When to use:** When you need server-side session management with cookie-based authentication

**Example:**
```typescript
// apps/api/src/config/session.ts
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

const pgSession = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new pgSession({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});
```

**Source:** [express-session docs](https://expressjs.com/en/resources/middleware/session.html), [connect-pg-simple npm](https://www.npmjs.com/package/connect-pg-simple)

### Pattern 2: Two-Level RBAC (Org + Project)

**What:** GitHub-style two-level roles where project roles inherit from org roles by default

**When to use:** Multi-tenant SaaS with organization and project hierarchy

**Example:**
```typescript
// Database schema (Prisma)
enum OrgRole {
  OWNER
  ADMIN
  OPERATOR
  VIEWER
}

enum ProjectRole {
  OWNER   // inherits from org
  ADMIN   // inherits from org
  OPERATOR
  VIEWER
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  members   OrganizationMember[]
  projects  Project[]
}

model OrganizationMember {
  id             String     @id @default(uuid())
  userId         String
  organizationId String
  role           OrgRole
  user           User       @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
}

model Project {
  id             String   @id @default(uuid())
  name           String
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  members        ProjectMember[]
}

model ProjectMember {
  id        String       @id @default(uuid())
  userId    String
  projectId String
  role      ProjectRole
  inheritedFromOrg Boolean @default(true) // if true, role derived from org
  user      User         @relation(fields: [userId], references: [id])
  project   Project      @relation(fields: [projectId], references: [id])
}
```

**Source:** [Stack Overflow - DB schema for RBAC](https://stackoverflow.com/questions/7329150/db-schema-for-rbac-with-multiple-levels-of-roles)

### Pattern 3: Docker Compose Base + Override

**What:** Separate base configuration from environment-specific overrides

**When to use:** Local development with docker-compose

**Example:**
```yaml
# docker-compose.yml (base)
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      SERVICES: s3
      DEFAULT_REGION: us-east-1
    volumes:
      - "./init-s3.sh:/etc/localstack/init/ready.d/init-s3.sh"
      - localstack_data:/var/lib/localstack

volumes:
  postgres_data:
  redis_data:
  localstack_data:
```

```yaml
# docker-compose.override.yml (local dev - auto-loaded)
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      - REDIS_URL=redis://redis:6379
      - LOCALSTACK_URL=http://localstack:4566
    depends_on:
      - db
      - redis
      - localstack

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - api
```

```bash
# setup script generates .env
#!/bin/bash
cat > .env << EOF
# Database
DB_USER=app
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME=docker_dashboard

# Session
SESSION_SECRET=$(openssl rand -base64 32)

# Auth
JWT_SECRET=$(openssl rand -base64 32)

# AWS (LocalStack)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
EOF
```

**Source:** [Docker Compose Override Files](https://docker.recipes/docs/compose-overrides)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session storage | In-memory | connect-pg-simple | MemoryStore leaks, not production-ready |
| Password hashing | Custom encoding | bcrypt | Industry standard, properly salted |
| Cookie security | Plain cookies | express-session with httpOnly | Prevents XSS token theft |
| Session expiry | Custom logic | express-session maxAge | Built-in, properly handled |

**Key insight:** express-session handles all session cookie security automatically when configured correctly. Never store tokens in localStorage for authenticated sessions.

## Common Pitfalls

### Pitfall 1: Session Cookie Not Persisting Across Requests
**What goes wrong:** User logs in but gets logged out on next request
**Why it happens:** Missing `saveUninitialized: false` or cookie settings incorrect
**How to avoid:** Set `saveUninitialized: false` and verify cookie domain matches
**Warning signs:** Session ID changes between requests, "Invalid session" errors

### Pitfall 2: PostgreSQL Session Table Not Created
**What goes wrong:** "relation session does not exist" error
**Why it happens:** connect-pg-simple requires session table in database
**How to avoid:** Use `createTableIfMissing: true` option or run provided SQL
**Warning signs:** First login attempt fails with relation error

### Pitfall 3: SameSite Cookie Misconfiguration
**What goes wrong:** Cross-site requests fail, CSRF protection too strict
**Why it happens:** Using `sameSite: 'strict'` blocks legitimate cross-origin requests
**How to avoid:** Use `sameSite: 'lax'` for development, `sameSite: 'none'` with `secure: true` for production APIs accessed from different domains
**Warning signs:** Login works but API calls from frontend fail

### Pitfall 4: Docker Compose Override Not Loading
**What goes wrong:** Local dev environment missing environment variables
**Why it happens:** docker-compose.override.yml must be in same directory and not gitignored
**How to avoid:** Name file exactly `docker-compose.override.yml`, include in git as template
**Warning signs:** Services start but can't connect to database

### Pitfall 5: LocalStack S3 Not Accessible
**What goes wrong:** S3 operations fail with connection errors
**Why it happens:** LocalStack needs init script or credentials not configured
**How to avoid:** Use init script to create buckets, use test credentials
**Warning signs:** "Unable to locate credentials" or bucket not found errors

## Code Examples

### Authentication Flow with Session Refresh
```typescript
// apps/api/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      name,
    },
  });
  
  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

export default router;
```

### RBAC Middleware
```typescript
// apps/api/src/middleware/rbac.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

type OrgRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
type ProjectRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

declare global {
  interface Express.Request {
    user?: {
      id: string;
      orgRole?: OrgRole;
      projectRole?: ProjectRole;
    };
  }
}

export function requireOrgRole(...allowedRoles: OrgRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const orgId = req.params.orgId || req.body.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }
    
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId: orgId,
      },
    });
    
    if (!membership || !allowedRoles.includes(membership.role as OrgRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    req.user = { id: userId, orgRole: membership.role as OrgRole };
    next();
  };
}

export function requireProjectRole(...allowedRoles: ProjectRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }
    
    const member = await prisma.projectMember.findFirst({
      where: {
        userId,
        projectId,
      },
      include: {
        project: {
          include: {
            organization: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });
    
    if (!member) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Use project role if set, otherwise inherit from org
    const role = member.inheritedFromOrg 
      ? member.project.organization.members[0]?.role 
      : member.role;
    
    if (!allowedRoles.includes(role as ProjectRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    req.user = { id: userId, projectRole: role as ProjectRole };
    next();
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JWT in localStorage | HTTP-only session cookies | 2020+ | Prevents XSS token theft |
| In-memory sessions | PostgreSQL sessions | Standard | Production-ready |
| MongoDB sessions | connect-pg-simple | Standard | Single DB for app + sessions |
| Role-based DB permissions | Application-level RBAC | Standard | More flexible, works with ORM |

**Deprecated/outdated:**
- JWT in localStorage: Vulnerable to XSS attacks
- MemoryStore for sessions: Memory leaks in production
- Separate session database: PostgreSQL handles both app data and sessions

## Open Questions

1. **LocalStack vs Real S3**
   - What we know: LocalStack provides S3-compatible API on port 4566
   - What's unclear: Whether all S3 operations needed are supported by LocalStack
   - Recommendation: Use LocalStack for dev, document how to switch to real AWS S3

2. **Onboarding Checklist UI**
   - What we know: Free users skip org creation, paid users guided to org or single host
   - What's unclear: Exact UI flow and which components to use
   - Recommendation: Use shadcn/ui components for checklist UI (deferred to UI implementation)

3. **Cookie Security for Production**
   - What we know: SameSite: 'lax' works for same-site, 'none' + secure for cross-site
   - What's unclear: Whether cloud dashboard will be on same domain as API
   - Recommendation: Start with 'lax', adjust to 'none' if API and UI on different domains

## Sources

### Primary (HIGH confidence)
- express-session docs - Session middleware configuration
- connect-pg-simple npm - PostgreSQL session store
- Docker Compose override files - Environment-specific config
- LocalStack S3 setup - Docker-based AWS mocking

### Secondary (MEDIUM confidence)
- Stack Overflow RBAC patterns - Two-level role inheritance
- GitHub-style org/repo permissions - Model for RBAC design
- OneUptime cookie security - SameSite configuration

### Tertiary (LOW confidence)
- Various blog posts on session management - Patterns, need validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Express/PostgreSQL well-documented, stable versions
- Architecture: HIGH - Session + RBAC patterns well-established
- Pitfalls: HIGH - Common issues with solutions documented

**Research date:** 2026-02-27
**Valid until:** 2026-04-27 (30 days for stable stack)
