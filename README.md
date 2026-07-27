# 🍽️ ResMan OS (SmartDine) — AI-Powered Restaurant Management System

> **Vibethon 6.0** · Team **ApexVoid** · Solo Participant: **Ayush Kumar**

[![CI](https://github.com/apexvoidd/resman/actions/workflows/ci.yml/badge.svg)](https://github.com/apexvoidd/resman/actions)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20Next.js-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 👤 Team Info

| Field | Details |
|---|---|
| **Hackathon** | Vibethon 6.0 |
| **Team Name** | ApexVoid |
| **Team Lead** | Ayush Kumar |
| **Participation** | Solo |

---

## 🧠 What is ResMan OS (SmartDine)?

**ResMan OS (SmartDine)** is a **full-stack, production-ready restaurant management system** built for modern dine-in restaurants. It digitises the entire restaurant workflow — from customer QR check-in to kitchen display, billing, Razorpay payments, floating top notifications, and post-meal reviews — all in real time.

No paper menus. No manual billing. No shouting across the floor.

---

## 🎯 Problem Solved

Traditional restaurants suffer from:
- Slow manual order taking → long wait times
- Paper bills → calculation errors and delays
- No real-time kitchen visibility → food getting cold
- Zero customer feedback loop
- No inventory tracking tied to actual orders

SmartDine solves all of this in one unified system.

---

## ✨ Features

### 🧑‍💼 Customer Flow
- **QR Code Check-in** — customers scan entrance QR, enter name + group size
- **Smart Table Assignment** — auto-assigns the best-fit table by capacity
- **Waitlist Queue** — joins queue if no table available, auto-assigned when one frees
- **Digital Menu** — browse, search, filter by category / vegetarian / vegan
- **Cart & Ordering** — add items, special instructions, place multiple orders per session
- **Top-Floating Popup Toast Notifications** — instant fixed top-center popups on mobile phones for order status updates (*Preparing*, *Food Ready*, *Served*), bill requests, Razorpay payment verification, and staff check-in alerts
- **Live Order Tracking** — real-time KDS progress bar (pending → preparing → ready)
- **Bill Request** — customer taps "Request Bill" (only after all orders complete)
- **Razorpay Payment** — UPI, card, net banking via Razorpay checkout
- **Split Bill** — equal, by item, or custom amount split
- **Post-Payment Review** — star rating per dish ordered, optional comment

### 🛎️ Waiter Dashboard
- **Arrival Verification** — confirm/reject guest arrivals at tables
- **Live Table Matrix** — see all tables with status, click to edit inline
- **Active Orders** — real-time order tracking across all tables
- **Bill Generation** — one-click consolidated bill for entire session
- **Notifications** — bill requests, order ready alerts, 3-min no-order reminders
- **Clear Notifications** — dismiss single or clear all

### 🍳 Kitchen Display System (KDS)
- **Live Order Cards** — auto-refreshing every 3 seconds
- **Status Flow** — Accept → Preparing → Ready → Complete
- **Priority Control** — Normal / High / Urgent (manager only)
- **Pause/Resume** — pause orders mid-preparation with reason
- **Delay Alerts** — visual warning when order exceeds estimated prep time
- **Search & Filter** — by order number or status

### 🧹 Cleaning Staff Dashboard
- **Cleaning Queue** — tables that need cleaning after bill payment
- **Mark Clean** — single tap to mark table as available
- **Live Polling** — auto-refreshes every 5 seconds

### 💵 Cashier POS
- **All Bills View** — see paid and unpaid bills
- **Cash Settlement** — confirm cash payment with change calculator
- **Session Unlock** — manager can unlock locked sessions

### 👔 Manager Executive Dashboard
- **Live KPIs** — today's revenue, active orders, table occupancy %, CSAT rating
- **Top Selling Items** — bar chart of best performers today
- **Recipe Profitability Analyser** — food cost vs selling price, gross margin %, max portions
- **Broadcast Alert** — send urgent announcements to all staff roles
- **Bulk Table Reset** — reset all cleaning/out-of-service tables at once
- **Operations Hub** — quick links to all sub-dashboards

### ⭐ Review System
- Only verified, paid customers can submit reviews
- One review per menu item per dining session
- Manager can reply, hide, or restore reviews
- Prevents duplicate reviews

### 📦 Inventory Management
- Ingredient CRUD with categories
- Stock tracking tied to recipe deductions
- Restock, manual adjustment, waste recording
- Low stock / out of stock alerts on manager dashboard

### 📖 Recipe Management
- Link menu items to ingredients with quantities
- Auto-deducts stock when kitchen accepts an order
- Profitability analyser shows cost/margin per dish

### 👥 Staff Management (Admin)
- Create staff with Clerk-linked accounts
- Role assignment (admin, manager, waiter, kitchen_staff, cashier, cleaning_staff)
- Enable/disable staff accounts
- Role-based access control on every page and API endpoint

### ⚙️ Settings
- Restaurant name, timezone, currency
- Tax percentage, service charge percentage
- Operating hours

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| **Backend** | FastAPI (Python 3.12), SQLAlchemy 2.0 async |
| **Database** | PostgreSQL (Neon) / SQLite (dev) |
| **Auth** | Clerk (JWT-based, role-aware) |
| **Payments** | Razorpay (UPI, Card, Net Banking) |

| **Containerisation** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions (lint, test, build) |

---

## 📁 Project Structure

```
res/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST API routes
│   │   │   ├── auth.py         # Clerk JWT auth
│   │   │   ├── billing.py      # Bills, payments, Razorpay
│   │   │   ├── guest.py        # QR check-in, table assignment
│   │   │   ├── inventory.py    # Ingredient stock management
│   │   │   ├── kds.py          # Kitchen Display System
│   │   │   ├── manager.py      # Manager KPIs & overrides
│   │   │   ├── menu.py         # Menu items & categories
│   │   │   ├── order.py        # Customer cart & orders
│   │   │   ├── recipe.py       # Recipe ingredient links
│   │   │   ├── review.py       # Customer reviews
│   │   │   ├── settings.py     # Restaurant configuration
│   │   │   ├── staff.py        # Staff CRUD
│   │   │   └── table.py        # Dining table management
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic layer
│   │   ├── middleware/         # CORS, rate limiting, security headers
│   │   └── core/               # Auth dependencies, error handlers
│   ├── migrations/             # Alembic database migrations
│   ├── scripts/                # Seed scripts (roles, etc.)
│   ├── tests/                  # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── billing/[billId]/   # Payment page
│   │   │   ├── cashier/            # Cashier POS
│   │   │   ├── cleaning/dashboard/ # Cleaning staff
│   │   │   ├── inventory/          # Inventory management
│   │   │   ├── join/               # Customer QR check-in
│   │   │   ├── join/menu/          # Customer digital menu
│   │   │   ├── kitchen/dashboard/  # KDS
│   │   │   ├── manager/dashboard/  # Manager executive hub
│   │   │   ├── menu/               # Menu management (admin)
│   │   │   ├── recipes/            # Recipe management
│   │   │   ├── reviews/            # Review submit & manage
│   │   │   ├── settings/           # Restaurant settings
│   │   │   ├── staff/              # Staff management
│   │   │   ├── tables/             # Table management
│   │   │   └── waiter/dashboard/   # Waiter POS
│   │   ├── components/             # Shared UI components
│   │   ├── hooks/                  # useRBAC, useRouteGuard
│   │   └── services/               # API client functions
│   ├── Dockerfile
│   └── next.config.ts
│
└── docker-compose.yml          # Full stack local setup
```

---

## 🚀 Running Locally

### Prerequisites
- Python 3.12+
- Node.js 20+
- Git

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in your values
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local       # fill in your values
npm run dev
```

### Or with Docker
```bash
cp .env.example .env             # fill in values
docker compose up --build
```

**API Docs:** http://localhost:8000/api/v1/docs

---

## 🌐 Environment Variables

### Backend (`.env`)
```env
APP_ENV=development
DATABASE_URL=sqlite+aiosqlite:///./restaurant_db.sqlite
SECRET_KEY=your-secret-key
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWKS_URL=https://xxx.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://xxx.clerk.accounts.dev
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_secret
```

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

---

## 🔑 Role-Based Access

| Role | Pages |
|---|---|
| `admin` | Everything |
| `manager` | Manager Dashboard, Waiter, Kitchen, Tables, Inventory, Menu, Reviews, Settings |
| `waiter` | Waiter Dashboard, Tables, Cashier |
| `kitchen_staff` | Kitchen Dashboard, Inventory |
| `cashier` | Cashier POS, Waiter Dashboard |
| `cleaning_staff` | Cleaning Dashboard |

---

## 🛣️ API Endpoints Summary

| Module | Base Path | Key Operations |
|---|---|---|
| Auth | `/api/v1/auth` | GET me, GET roles |
| Guest | `/api/v1/guest` | Session, table find, queue, verify |
| Order | `/api/v1/orders` | Place, update, cancel, session history |
| KDS | `/api/v1/kds` | Accept, prepare, ready, complete, pause |
| Billing | `/api/v1/billing` | Generate, Razorpay, cash, split, invoices |
| Menu | `/api/v1/menu` | Categories, items, image upload |
| Tables | `/api/v1/tables` | CRUD, status, cleaning queue |
| Inventory | `/api/v1/inventory` | Ingredients, restock, waste, history |
| Recipes | `/api/v1/recipes` | Recipe-ingredient links |
| Reviews | `/api/v1/reviews` | Submit, manage, reply, hide |
| Staff | `/api/v1/staff` | CRUD, roles, status toggle |
| Manager | `/api/v1/manager` | Overview KPIs, profitability, broadcast |
| Settings | `/api/v1/settings` | Restaurant config |

---

## ⚠️ Beta Features

The following features are present but marked **beta** — they work in basic form but are not fully polished:

| Feature | Status | Notes |
|---|---|---|
| **Staff Role-Based Nav** | 🟡 Beta | `RouteGuard`, `AppLayout`, `Navbar` components exist but not fully wired to every page. |
| **Loyalty / Rewards** | ❌ Not Implemented | Models exist in DB schema, no UI or service logic built. |
| **Customer Accounts** | ❌ Not Implemented | Guests can order without accounts. Registered customer profiles exist in DB but no registration flow. |
| **Analytics Dashboard** | ❌ Not Implemented | Manager KPIs are live data but no charts/graphs UI beyond top selling items. |

---

## 📸 Pages Overview

| Page | URL | Role |
|---|---|---|
| Customer Check-in | `/join` | Public |
| Customer Menu | `/join/menu` | Public |
| Billing & Payment | `/billing/[billId]` | Public |
| Leave a Review | `/reviews/submit` | Public (post-payment) |
| Sign In | `/sign-in` | Public |
| Waiter Dashboard | `/waiter/dashboard` | waiter, manager, admin |
| Kitchen (KDS) | `/kitchen/dashboard` | kitchen_staff, manager, admin |
| Cleaning | `/cleaning/dashboard` | cleaning_staff, manager, admin |
| Cashier POS | `/cashier` | cashier, waiter, manager, admin |
| Manager Hub | `/manager/dashboard` | manager, admin |
| Tables | `/tables` | waiter, manager, admin |
| Menu Management | `/menu/items` | manager, admin |
| Inventory | `/inventory` | kitchen_staff, manager, admin |
| Recipes | `/recipes` | manager, admin |
| Staff | `/staff` | admin |
| Reviews Management | `/reviews/manage` | manager, admin |
| Settings | `/settings` | admin |

---

## 🏆 Hackathon Highlights

- **End-to-end flow** — from customer QR scan to paid bill to review, zero manual intervention
- **Real-time** — 3-second polling on all dashboards, instant notifications
- **Multi-role** — 6 distinct staff roles, each with scoped access
- **Mobile-friendly** — all dashboards fully responsive
- **Production-ready** — Docker, CI/CD, Alembic migrations, CORS, error handling, audit logs, soft deletes
- **Security** — HMAC Razorpay verification, Clerk JWT auth, HTML sanitization on reviews, rate limit middleware

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ for Vibethon 6.0 by Ayush Kumar — ApexVoid*
