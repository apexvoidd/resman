# Architecture Overview - Smart Restaurant Management System

## System Architecture

The Smart Restaurant Management System is built on a decoupled, modular architecture designed for high scalability, fault tolerance, and easy extension.

```
[ Client (Browser / PWA) ]
          │
          │ HTTPS / WebSockets
          ▼
   [ Next.js Frontend ] ───(Vercel)
          │
          │ REST API
          ▼
    [ FastAPI Backend ] ───(Railway)
      │          │
      ▼          ▼
[ PostgreSQL ] [ Redis Cache ]
  (Neon)        (Upstash)
```

## Tech Stack & Provider Mapping

| Layer | Component | Cloud Provider / Tool |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS | Vercel |
| **Backend** | FastAPI, Python 3.12+, Pydantic v2 | Railway |
| **Database** | PostgreSQL 16, SQLAlchemy 2.x Async, Alembic | Neon |
| **Caching** | Redis | Upstash |
| **Object Storage** | Supabase Storage / Cloudflare R2 / Local | Supabase / Cloudflare R2 / Local |
| **Realtime Messaging** | WebSockets / Server-Sent Events | Pusher / Ably Ready |
| **Monitoring** | Error Tracking | Sentry |
| **Logging** | Structured JSON Logs | Better Stack |

## Backend Project Layout

- `app/api/`: Versioned API routing endpoints (`v1/endpoints/`)
- `app/core/`: Application settings, security utilities, logging configuration, global error handling
- `app/db/`: SQLAlchemy 2.x async engine, session makers, base models
- `app/middleware/`: CORS configuration, Security Headers, Rate Limiting
- `app/models/`: Database domain models (SQLAlchemy ORM)
- `app/schemas/`: Pydantic schemas for data validation and serialization
- `app/services/`: Business logic layer
- `app/repositories/`: Data access layer
- `app/utils/`: Shared utilities and helpers

## Frontend Project Layout

- `src/app/`: Next.js App Router pages and layouts
- `src/components/`: Reusable UI components
- `src/hooks/`: Custom React hooks
- `src/lib/`: Core client libraries (TanStack Query client, utils, env validation)
- `src/store/`: Global state management with Zustand
- `src/services/`: API client functions
- `src/types/`: TypeScript type definitions
- `src/styles/`: Global styles and Tailwind configuration
