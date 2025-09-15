# Stage 1: Build frontend (if you have a build step, e.g. React/Vue)
# FROM node:18 AS build
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# RUN npm run build

# Stage 2: Production server
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

# Expose the port from your .env (default 1713)
EXPOSE 1713

CMD ["node", "server/index.js"]