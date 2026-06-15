# StartupHub

**Unified AI-native workspace for startups. Captures ideas, organizes context, prevents chaos.**

---

## The Problem

Startup teams use 5+ disconnected tools (WhatsApp, Slack, GitHub, Figma, Jira). Context is fragmented:

- **Ideation:** Good ideas get lost in chat. Meeting details buried in long notes. Same ideas discussed repeatedly.
- **Execution:** Engineers waste 2+ hours/day context-switching. Design-dev misalignment. New hires take weeks to understand architecture.

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

**Ideation Side:**
- ⚡ Instant idea capture (global shortcut)
- 🔗 AI-powered idea linking (prevent duplicates)
- 📋 Auto-extract meeting details (decisions, constraints, metrics)
- ✅ Track idea → project conversion
- 📊 Momentum tracking (alert on stalled ideas)

**Execution Side:**
- 📊 Unified dashboard (all context visible)
- 💻 Code → context mapping (why was this written?)
- 🔍 Semantic search (across all sources)
- 🎨 Design-dev sync (Figma ↔ GitHub)
- ⚠️ Blocker detection (auto-flagged)

---

## Tech Stack

**Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui  
**Backend:** Node.js + Express + Socket.io  
**Database:** PostgreSQL (Supabase) + pgvector  
**AI:** Claude API (summarization, embeddings)  
**Integrations:** Twilio (WhatsApp), Slack, GitHub  
**Deployment:** Vercel + Railway + Supabase  
**Cost:** $0 (all free tiers)

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL
- Claude API key
- Twilio account
- Slack Bot token
- GitHub token

### Setup

1. **Clone**
```bash
git clone https://github.com/yourusername/startuphub.git
cd startuphub
```

2. **Frontend**
```bash
cd frontend
npm install
npm run dev
```

3. **Backend**
```bash
cd backend
npm install
cp .env.example .env
# Fill in: CLAUDE_API_KEY, TWILIO_ACCOUNT_SID, etc
npm run dev
```

4. **Database**
```bash
# Create Supabase project
# Run migrations
npm run db:migrate
```

5. **Connect WhatsApp**
- Set Twilio webhook to: `http://localhost:3001/webhooks/whatsapp`
- Send test message to verify

---

## How It Works

1. **Capture:** Ideas mentioned in WhatsApp/Slack → auto-captured via global shortcut
2. **Extract:** Meeting notes processed by Claude → decisions, constraints, metrics extracted
3. **Link:** Related ideas connected automatically using AI embeddings
4. **Track:** Project created from idea → auto-breakdown into tasks
5. **Execute:** Engineers access unified dashboard → full context visible
6. **Onboard:** New hires get auto-generated PDF → understand in hours

---

## Contributing

This is a hackathon project. We'd love feedback and contributions:

1. Fork repo
2. Create feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open Pull Request
