# Smart Restaurant Management System

A production-ready, scalable Smart Restaurant Management System architecture built with a modern full-stack tech stack.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19, Tailwind CSS, shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms & Validation**: React Hook Form, Zod
- **Type Safety**: TypeScript

### Backend
- **Framework**: FastAPI (Python 3.12+)
- **ORM**: SQLAlchemy 2.x (Async)
- **Database Migrations**: Alembic
- **Validation**: Pydantic v2
- **Database**: PostgreSQL (Neon compatible)
- **Caching**: Redis (Upstash compatible)

### Infrastructure & Deployment Target
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Railway
- **Database**: Neon (PostgreSQL)
- **Object Storage**: Cloudflare R2 Ready
- **Realtime Provider**: Pusher / Ably Ready
- **Monitoring**: Sentry Ready
- **Logging**: Better Stack Compatible (Structured JSON Logging)

---

## Folder Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # Versioned API routes (v1)
│   │   ├── config/       # Pydantic BaseSettings management
│   │   ├── core/         # Logging, Security, Error handling
│   │   ├── db/           # SQLAlchemy 2.x async session & Base
│   │   ├── middleware/   # CORS, Security headers, Rate limiters
│   │   ├── models/       # Database ORM models (empty for now)
│   │   ├── repositories/ # Data access layer
│   │   ├── schemas/      # Pydantic data schemas
│   │   ├── services/     # Business logic layer
│   │   └── utils/        # Common utilities
│   ├── migrations/       # Alembic migrations directory
│   ├── tests/            # Pytest test suite
│   ├── alembic.ini       # Alembic migration configuration
│   ├── Dockerfile        # Production container build
│   └── requirements.txt  # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router (layout, page, globals.css)
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # QueryClient, utils, providers
│   │   ├── services/     # API service clients
│   │   ├── store/        # Zustand stores
│   │   ├── styles/       # Tailwind CSS & global styles
│   │   └── types/        # TypeScript type definitions
│   ├── Dockerfile        # Production multi-stage Docker build
│   └── package.json      # Frontend package configuration
├── docs/                 # System architecture documentation
├── infrastructure/       # IaC & Deployment manifests
├── scripts/              # Local setup & utility scripts
├── .github/workflows/    # GitHub Actions CI pipeline
├── docker-compose.yml    # Local development multi-container setup
└── README.md             # Project documentation
```

---

## Quick Start (Local Setup Instructions)

### Option 1: Automated Script Setup

Run the setup script:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Option 2: Docker Compose (Recommended)

Start all services (Frontend, Backend, PostgreSQL, Redis) with a single command:

```bash
docker-compose up --build
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **API Docs (Swagger UI)**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)

### Option 3: Manual Local Development

1. **Backend Setup**:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   uvicorn app.main:app --reload --port 8000
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cp .env.example .env.local
   npm run dev
   ```

---

## API Verification

### Root Endpoint
`GET http://localhost:8000/`
```json
{
  "status": "ok",
  "message": "Restaurant Management API Running"
}
```

### Health Check Endpoint
`GET http://localhost:8000/health`
```json
{
  "status": "healthy",
  "app_name": "Smart Restaurant Management System",
  "environment": "development",
  "version": "0.1.0"
}
```

---

## Development Workflow & Code Quality

### Backend Quality Commands
```bash
cd backend
ruff check .           # Linting
black --check .        # Formatting check
black .                # Apply auto-formatting
pytest                 # Run test suite
```

### Frontend Quality Commands
```bash
cd frontend
npm run lint           # ESLint
npx prettier --check . # Formatting check
npx prettier --write . # Apply auto-formatting
npm run build          # Build check
```

---

## Deployment Strategy

- **Frontend**: Deploy `frontend/` to **Vercel** via GitHub integration. Set environment variable `NEXT_PUBLIC_API_URL`.
- **Backend**: Deploy `backend/` to **Railway** using the provided `Dockerfile`. Set environment variables listed in `backend/.env.example`.
- **Database**: Provision PostgreSQL instance on **Neon** and set `DATABASE_URL` in Railway.
- **Cache**: Provision Redis on **Upstash** and set `REDIS_URL`.
