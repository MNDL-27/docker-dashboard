FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY apps/web/package.json ./

# Install dependencies
RUN npm install

# Copy source
COPY apps/web/src/ ./src/
COPY apps/web/next.config.ts ./
COPY apps/web/tsconfig.json ./

EXPOSE 3000

CMD ["npx", "next", "dev", "--port", "3000"]
