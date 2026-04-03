# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Development Commands

### Environment Setup
- Install dependencies: `npm install`
- Initialize database schema: `node netlify/init-db.mjs`
- Run migrations: `node netlify/check-db.mjs` (if available/implemented)

### Running the App
- Start development server (V16/Netlify dev): `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

### Testing
- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`

### Linting & Formatting
- Lint code: `npm run lint`

## 🏗 Architecture & Structure

### High-Level Overview
This is a full-stack application for managing Docker fleets. It uses a serverless backend (Netlify Functions) and a React frontend (Vite).

### Backend (Netlify Functions)
Located in `netlify/functions/`.
- **API Endpoints**: Implemented as `.mts` files (e.g., `api-docker-hosts.mts`).
- **Key Functionlagility**: Handles database interactions (PostgreSQL), authentication, and proxying requests to agents.
- **Data Layer**: Uses PostgreSQL with a focus on managing host information, agent status, and fleet metrics.

### Frontend
A React application built with TypeScript.
- **Components**: Organized by domain (e.g., `src/components/ui` for primitives, and feature-specific folders).
- **Pages/Routes**: Managed via standard React routing, with key views located in `src/pages` (via app router logic).
- **State Management**: Likely utilizes React hooks and context for application state.
- **API Interaction**: Uses a service layer/hooks to communicate with the Netlify functions.

### Core Domains
- **Fleet Management**: Tracking hosts, agents, and containers.
- **Metrics**: Aggregating performance data from agents.
- **Authentication**: Managing access to the dashboard.
