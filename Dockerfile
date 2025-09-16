FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend and frontend code
COPY server/ ./server/
COPY public/ ./public/

# Ensure build output is included if you use Vite/React
# If your SPA needs build step:
# COPY public/package*.json ./public/
# RUN cd public && npm ci && npm run build

EXPOSE 1714
CMD ["node", "server/index.js"]
