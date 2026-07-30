# ResMan OS — Enterprise Restaurant Management System

> **Vibeathon 6.0** · Team **ApexVoid** · Solo Participant: **Ayush Kumar**

ResMan OS is a full-stack restaurant management system built for modern dine-in operations for **Vibeathon 6.0**. It digitizes the entire restaurant workflow—starting when a customer scans the **Entrance QR Code** to check in at `/join`, get assigned a table or join the waitlist, browse the digital menu, and place orders, through to kitchen display execution, automated recipe inventory deduction, cashier POS settlement, Razorpay payments, live notification chimes, and post-meal customer reviews.

---

## Live Deployments & API Reference

| Component | URL | Status |
|---|---|---|
| **Frontend Application** | [https://resman-aqqx.vercel.app](https://resman-aqqx.vercel.app) | Live on Vercel |
| **Backend API** | [https://resman-backend.onrender.com](https://resman-backend.onrender.com) | Live on Render |
| **OpenAPI / Swagger Docs** | [https://resman-backend.onrender.com/docs](https://resman-backend.onrender.com/docs) | Interactive API Spec |
| **ReDoc Documentation** | [https://resman-backend.onrender.com/redoc](https://resman-backend.onrender.com/redoc) | ReDoc API Spec |

---

## Team & Hackathon Information

- **Hackathon**: Vibeathon 6.0
- **Team Name**: ApexVoid
- **Team Lead & Solo Developer**: Ayush Kumar
- **Project Name**: ResMan OS

---

## Testing Guide & End-to-End Workflow

### Recommended Setup (Single Device or Multi-Device)

You can test the entire real-time restaurant lifecycle on **a single device using side-by-side browser tabs** or **two separate devices** (e.g. smartphone for customer + laptop for staff).

> **Important Pro-Tip for Testers**:
> - **Public Guest Access**: Customer check-in (`/join`), digital menu (`/join/menu`), payment pages (`/billing/[billId]`), and dish reviews (`/reviews/submit`) do **not** require login.
> - **Staff Role Access**: Staff dashboards (`/waiter/dashboard`, `/kitchen/dashboard`, `/cleaning/dashboard`, `/cashier`, `/manager/dashboard`) require signing in via `/sign-in`.
> - **Shortcut**: To test all staff dashboards simultaneously without switching accounts, **sign in with an Admin or Manager account**. Admin and Manager roles have master access across all staff screens (Waiter, Kitchen KDS, Cashier POS, Cleaning Queue, Inventory, and Executive Hub).

#### Tab Setup Recommendation for Testing (Side-by-Side):
- **Tab 1 (Customer Portal)**: `https://resman-aqqx.vercel.app/join` (Public - No login required)
- **Tab 2 (Waiter Dashboard)**: `https://resman-aqqx.vercel.app/waiter/dashboard` (Requires Staff Login)
- **Tab 3 (Kitchen Display / KDS)**: `https://resman-aqqx.vercel.app/kitchen/dashboard` (Requires Staff Login)
- **Tab 4 (Cashier POS)**: `https://resman-aqqx.vercel.app/cashier` (Requires Staff Login)
- **Tab 5 (Cleaning Dashboard)**: `https://resman-aqqx.vercel.app/cleaning/dashboard` (Requires Staff Login)
- **Tab 6 (Manager Hub)**: `https://resman-aqqx.vercel.app/manager/dashboard` (Requires Staff Login)

---

### End-to-End Workflow Diagram

```mermaid
flowchart TD
    S1["1. Customer QR Check-in (/join)"] --> S2["2. Waiter Verifies Arrival (/waiter)"]
    S2 --> S3["3. Browse & Place Order (/join/menu)"]
    S3 --> S4["4. Kitchen KDS Prepares & Deducts Stock (/kitchen)"]
    S4 --> S5["5. Real-time Sound & Toast Alert to Customer"]
    S5 --> S6["6. Waiter Serves Food & Multi-Round Orders"]
    S6 --> S7["7. Customer Requests Bill (/join/menu)"]
    S7 --> S8["8. Payment: Razorpay Online or Cashier Cash (/billing)"]
    S8 --> S9["9. Cleaning Queue & Auto-Next Waitlist Assignment"]
    S9 --> S10["10. Verified Customer Dish Review (/reviews/submit)"]
```

---

### Detailed 10-Step Testing Walkthrough

#### Step 1: Customer Check-In (`/join`)
1. Open `/join` on Tab 1 (Customer screen).
2. Select party size (e.g. `2 Guests`), enter Guest Name (e.g. `John`), and click **Find Table**.
3. ResMan OS automatically assigns an available dining table matching the group size (or places the customer in the Waitlist Queue if all matching tables are full).
4. Click **Proceed to Menu** to view the assigned table status.

#### Step 2: Waiter Dashboard Arrival Verification (`/waiter/dashboard`)
1. Switch to Tab 2 (Waiter Dashboard).
2. The newly assigned guest and table will appear under **Pending Arrival Verifications**.
3. Click **Confirm Arrival** to verify the guest is seated.

#### Step 3: Digital Menu Browsing & Order Placement (`/join/menu`)
1. Return to Tab 1 (Customer screen). Notice the digital menu is now unlocked.
2. Filter dishes by categories (Mains, Drinks, Veg) or search for specific items.
3. Add items to cart, enter special instructions (e.g. *"Extra spicy"*), and click **Place Order**.
4. The customer screen displays the active order status.

#### Step 4: Kitchen KDS Execution & Recipe Stock Deduction (`/kitchen/dashboard`)
1. Switch to Tab 3 (Kitchen Display System).
2. The incoming order card appears live on the KDS Kanban board under the **Pending** column.
3. Move the card to **Preparing** or click **Accept**.
   - *Automated Backend Action*: Upon acceptance, raw ingredient quantities defined in the dish's recipe configuration are automatically deducted from the inventory stock.
4. Move the order card to **Ready** when preparation is complete.

#### Step 5: Real-Time Audio Chime & Status Alert (Customer Screen)
1. Switch back to Tab 1 (Customer screen).
2. An audio chime plays and a status notification toast pops up (*"Order is READY! Waiter will bring your food shortly."*).

#### Step 6: Waiter Serving & Multi-Round Orders
1. On Tab 2 (Waiter Dashboard), the waiter marks the order status as **Served**.
2. Customers can place additional order rounds during the same dining session at any time.

#### Step 7: Requesting the Bill (`/join/menu`)
1. On Tab 1 (Customer screen), click **Request Bill**.
2. An instant notification chime alerts both the Waiter and Cashier dashboards.

#### Step 8: Bill Settlement & Payment (`/billing/[billId]` or `/cashier`)
1. On Tab 1, click **Pay Bill** to navigate to the billing page (`/billing/[billId]`).
2. Choose a settlement method:
   - **Razorpay Online Payment**: Pay via UPI/Card/Net Banking (test mode). Includes per-person split calculator.
   - **Cashier POS Settlement**: Switch to Tab 4 (`/cashier`), select the table's bill, enter cash tendered, calculate change, and settle the bill.

#### Step 9: Cleaning Queue & Auto-Waitlist Assignment (`/cleaning/dashboard`)
1. Once paid, the table state transitions to **Needs Cleaning**.
2. Switch to Tab 5 (`/cleaning/dashboard`). Click **Mark Cleaned**.
3. *Automated Backend Action*: The table becomes **Available**. If customers are waiting in the queue, ResMan OS automatically assigns the freshly cleaned table to the next waitlisted group.

#### Step 10: Verified Dish Review & Executive Analytics (`/reviews/submit` & `/manager/dashboard`)
1. On Tab 1, post-payment redirects the customer to submit 1-5 star ratings per ordered dish.
2. Switch to Tab 6 (`/manager/dashboard`) to view updated real-time sales KPIs, average rating CSAT metrics, recipe profit margins, and AI Assistant query capabilities.

---

## Architecture & Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State & Data Fetching**: React Query (TanStack Query), Zustand

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Database ORM**: SQLAlchemy 2.0 (Async) with Alembic migrations
- **Database Engine**: PostgreSQL (Neon in production, SQLite for local development)
- **Authentication**: Clerk JWT with Role-Based Access Control (RBAC)
- **LLM Integration**: NVIDIA NIM API (Meta Llama 3.1 70B Instruct) with Server-Sent Events (SSE) streaming
- **Payment Processing**: Razorpay Webhooks and Verification SDK

---

## Key System Components

1. **Customer QR Portal (`/join` & `/join/menu`)**
   - Entrance QR check-in with automatic table allocation or waitlist assignment.
   - Live category filtering, search, and dish customization.
   - Real-time order progress tracking, audio chimes, and status toast notifications.
   - Digital bill request and Razorpay online checkout or cash payment.
   - Post-payment verified dish review submission.

2. **Kitchen Display System (`/kitchen/dashboard`)**
   - Drag-and-drop Kanban interface for order status transitions.
   - Dedicated Paused column and custom pause reason modal.
   - Auto-deduction of raw ingredient inventory based on dish recipe configurations.
   - Priority tagging (Normal, High, Urgent) and prep time elapsed warnings.

3. **Waiter POS (`/waiter/dashboard`)**
   - Real-time table matrix showing occupancy and guest verification status.
   - Audio chime notifications for incoming customer alerts and bill requests.
   - One-click session bill generation.

4. **Cashier POS (`/cashier`)**
   - Settlement terminal for cash, card, and digital transactions.
   - Cash change calculator and receipt printing.

5. **Manager Executive Hub & AI Assistant (`/manager/dashboard`)**
   - Executive KPIs: daily revenue, occupancy rate, low-stock counts, average rating.
   - AI Manager Assistant powered by NVIDIA NIM for natural language database queries.
   - Global restaurant status toggle (Open / Closed).
   - Recipe profitability and gross margin analysis.

6. **Inventory & Recipes (`/inventory` & `/recipes`)**
   - Ingredient stock tracking, restock logs, and waste recording.
   - Automated recipe costing and margin calculation per dish.

---

## Project Structure

```
res/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # API routes (AI, Billing, KDS, Guest, Inventory, etc.)
│   │   ├── core/               # Dependencies, security, RBAC
│   │   ├── db/                 # Session management and startup migrations
│   │   ├── models/             # SQLAlchemy ORM schemas
│   │   ├── schemas/            # Pydantic request/response models
│   │   └── services/           # Business logic and AI assistant service
│   ├── migrations/             # Alembic database migrations
│   └── tests/                  # Pytest test suite
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   ├── components/         # Reusable UI components (AppLayout, AIChatDrawer, etc.)
│   │   ├── hooks/              # Custom React hooks (useRBAC, etc.)
│   │   └── services/           # API integration clients
└── docker-compose.yml          # Local container configuration
```

---

## Running Locally

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL or SQLite

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Docker Setup
```bash
docker compose up --build
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
APP_ENV=development
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/resman
SECRET_KEY=your-secret-key
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWKS_URL=https://xxx.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://xxx.clerk.accounts.dev
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your-secret
NVIDIA_NIM_API_KEY=nvapi-xxx
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

---

## Changes Since Round 1 (Commit `32ecdb9d661f07ea9b8b08b1839828fea9dda582`)

### Features Added
- **AI Manager Assistant Streaming**: Added a Server-Sent Events (SSE) streaming endpoint (`/api/v1/manager/ai/chat/stream`) and frontend integration in `AIChatDrawer.tsx` for real-time word-by-word AI response streaming.
- **NVIDIA NIM & Database Context Integration**: Built context synthesis engine combining live sales, low stock, active orders, and table occupancy data into system prompts for Meta Llama 3.1 70B Instruct model with automatic fallback engine.
- **KDS Kanban Board Enhancements**: Converted Kitchen Display System to a flex-scrolling Drag & Drop Kanban board with status columns (`Pending`, `Preparing`, `Ready`, `Completed`, and `Paused`).
- **KDS Pause Workflow**: Replaced browser `prompt()` dialogs with a custom Pause Order modal for entering pause reasons.
- **Audio Notification System**: Integrated Web Audio API chime notifications for Waiter POS alerts and customer order status updates (`Preparing`, `Ready`, `Served`), including single-gesture AudioContext initialization for browser autoplay compliance.
- **Restaurant Status Control**: Added a global Open/Closed status toggle for managers in the navigation header to control order acceptance.
- **Dynamic Billing Charges**: Added restaurant-configurable tax and service charge percentages applied during bill generation.
- **Menu Ratings**: Added customer star rating aggregation to menu items displayed on guest menus.

### Fixes & Improvements
- **Persistent Header Layout**: Refactored `AppLayout.tsx` to fix the top navigation bar at the top of the viewport across mobile and desktop devices.
- **PostgreSQL Migration Compatibility**: Updated startup DB initialization (`db/session.py`) to handle automatic column migrations (`is_closed` settings) on PostgreSQL instances.
- **Billing Eager Loading**: Fixed SQLAlchemy `MissingGreenlet` async execution errors during bill generation by eagerly loading items and table relationships.
- **Database Connection Pooling**: Enabled `pool_pre_ping` and `pool_recycle` on database engine creation to prevent stale database connection drops.
- **NVIDIA NIM Timeout Handling**: Extended HTTP client timeout to 45 seconds for high-parameter model inference.
- **Frontend Split Bill**: Replaced backend API split bill calculations with an inline frontend per-person calculator.

### UI Cleanups
- Removed obsolete "Register" button from the main navigation header bar.
- Removed non-functional "Stock Audit History" tab from the Inventory Control page.
- Restricted Waiter POS notifications container height with vertical scrolling to prevent page overflow.
