# StartupHub

StartupHub is an AI-native workspace for startups that turns scattered team context into one usable operating system for ideas, projects, tasks, decisions, and live updates.

---
## The Problem

Startups lose momentum when important context lives in too many places:

- WhatsApp and Slack conversations
- GitHub PRs and issues
- meeting notes and informal updates
- project dashboards that do not reflect real team activity

Engineers waste 2+ hours/day context-switching. Design-dev misalignment. New hires take weeks to understand architecture. StartupHub brings those signals together into a single dashboard and AI-assisted workflow.

---
## The Solution 
StartupHub centralizes all context and delivers it two ways:

### For Active Team: Real-time Dashboard
- See all decisions, constraints, design specs in one place
- Highlight code → instantly see why it was written
- Semantic search across Slack, GitHub, Figma, meetings
- Auto-detect blockers

### For New Hires: Auto-Generated PDF
- Onboarding doc created automatically from all sources
- Project overview, key decisions, technical constraints, architecture
- Meeting summaries with niche details preserved
- Understand in hours, not weeks

---
## Features

### Ideation Side:
- capture ideas and link related concepts
- detect duplicate or similar ideas
- convert ideas into projects
- keep task and decision context attached to each project

### Execution Side:
- unified dashboard for projects, decisions, blockers, and action items
- communication hub for messages and extracted insights
- briefing and onboarding tools for fast context sharing
- live updates and momentum alerts

---
## Tech stack

**Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Query, Zustand  
**Backend**: Node.js, Express, Socket.io, TypeScript  
**AI**: Anthropic Claude API with fallback processing  
**Data**: PostgreSQL / Supabase-style storage, pgvector support, JSON fallback mode  
**Cost:** $0 (all free tiers)

---
## Project structure

- `frontend/` – Vite React app and dashboard UI
- `backend/` – Express API, AI services, Socket.io, DB access
- `chrome-extension/` – browser extension companion assets

---
## Getting Started

### Prerequisites
- Node.js 20+
- npm or pnpm
- a PostgreSQL/Supabase connection or local fallback mode
- a Claude API key (optional, fallback works without it)

### 1. Clone
```bash
git clone https://github.com/yourusername/startuphub.git
cd startuphub
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 4. Database
If you want full database-backed behavior, configure `DATABASE_URL` and run:
```bash
cd backend
npm run db:migrate
```

---
## Environment notes

The backend currently supports:
- real Claude-powered AI extraction when `CLAUDE_API_KEY` is available
- fallback parsing and local logic when the API key is not configured
- JSON-based fallback mode if the database connection is unavailable

---

## How the MVP works

1. Team activity flows into the dashboard through the backend.
2. AI extracts decisions, blockers, and tasks from messages and project updates.
3. The frontend surfaces those insights in focused views such as Communication Hub and Project Workspace.
4. Users can switch between projects, tools, and ideas without losing context.

---

## Contributing
This is a hackathon project. We'd love feedback and contributions:
1. Fork repo
2. Create feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open Pull Request
