# Issue Finder Web

Full-stack web application for discovering high-quality GitHub issues matching PR Writer HFI criteria.

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Framer Motion, Recharts
- **Backend:** FastAPI, SQLAlchemy (async), SQLite, JWT Auth, WebSocket streaming
- **Design:** Dark luxury aesthetic with gold accents, glass morphism, editorial typography

## Features

- Repo discovery (trending, topics, curated) with real-time WebSocket streaming
- Smart issue filtering & relevance ranking
- Full issue analysis with scoring breakdown
- Autoscan pipeline (discover → scan → results)
- PR diff viewer with syntax highlighting
- Profile & language selection (Python/JS/TS)
- Scan history & analytics dashboard with charts
- Bookmarks with status tracking
- Notification system for bookmarked repos
- GitHub OAuth + email/password authentication
- JSON/CSV export
- Keyboard shortcuts

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# Frontend
cd frontend
pnpm install
pnpm dev
```

Or use the start script:
```bash
./start.sh
```

Open http://localhost:3000

## Environment Variables

Create `backend/.env`:
```
SECRET_KEY=your-secret-key
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-secret
```
