# Streamm 🎬

A modern self-hosted media streaming server with an on-the-fly transcoding backend and a sleek React frontend.

## Project Structure

```text
Streamm/
├── frontend/             # React + Vite client web application (Tailwind CSS, HLS video player)
├── backend/              # Node.js + Express streaming & metadata server
├── .gitignore            # Git exclusion rules for caches, media, and environment secrets
└── README.md             # Project documentation
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Update .env with your desired PORT, JWT_SECRET, and media LIBRARY_PATHS
npm start
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Deployment

- **Frontend (Vercel)**: When deploying to Vercel, configure the project's **Root Directory** as `frontend` in your Vercel Project Settings.
- **Backend**: Can be hosted on your local media server or VPS, exposed securely using Cloudflare Tunnel or reverse proxy.
