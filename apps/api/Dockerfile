FROM node:22-alpine

WORKDIR /app

# Copy prisma schema first (needed for postinstall generate)
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

# Copy API package files
COPY apps/api/package.json ./

# Install dependencies (triggers prisma generate via postinstall)
RUN npm install

# Copy API source
COPY apps/api/src/ ./src/
COPY apps/api/tsconfig.json ./

EXPOSE 3001

CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]
