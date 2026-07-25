# Database Design Documentation

Smart Restaurant Management System — Production PostgreSQL Schema

---

## Design Philosophy

### Why UUID Primary Keys?
UUIDs prevent sequential enumeration attacks, allow IDs to be generated client-side or at the application layer without hitting the database, and are safe for SaaS multi-tenant scenarios where IDs from different databases may be merged.

### Why Async SQLAlchemy 2.x?
SQLAlchemy 2.x with `asyncpg` driver allows the FastAPI backend to handle thousands of concurrent requests without blocking on I/O. The `AsyncSession` pattern pairs naturally with Python async/await.

### Why Soft Deletes?
Critical entities (Restaurant, Branch, User, Customer, MenuItem, Order, Bill, Coupon, Review) use `deleted_at` timestamps instead of hard deletes. This:
- Preserves audit trails and historical reporting
- Avoids cascading FK violations in billing/order history
- Allows record recovery without data loss

### Why Normalized JSONB for Flexible Payload?
`AuditLog.old_value`/`new_value` and `Notification.payload_json` use PostgreSQL JSONB for schema-less context. This avoids premature normalization of highly variable data while still keeping it indexed and queryable.

---

## Tables Reference

### Multi-Tenancy Layer

#### `restaurants`
Root SaaS tenant. Every resource in the system belongs (directly or transitively) to a restaurant.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR(255) | Restaurant display name |
| logo_url | VARCHAR(1024) | CDN URL for logo (Cloudflare R2) |
| phone | VARCHAR(50) | Contact phone |
| email | VARCHAR(255) | Contact email |
| address | TEXT | Street address |
| city | VARCHAR(100) | City |
| state | VARCHAR(100) | State/Province |
| country | VARCHAR(100) | Country |
| postal_code | VARCHAR(20) | ZIP/Postal code |
| timezone | VARCHAR(50) | IANA timezone (e.g. `Asia/Kolkata`) |
| currency | VARCHAR(10) | ISO currency code (e.g. `INR`, `USD`) |
| is_active | BOOLEAN | Soft activation flag |
| created_at | TIMESTAMPTZ | Auto-set on creation |
| updated_at | TIMESTAMPTZ | Auto-set on update |
| deleted_at | TIMESTAMPTZ | Soft delete timestamp |

**Indexes:** `name`, `email`, `is_active`

---

#### `branches`
Physical locations belonging to a restaurant. All operational data (orders, tables, staff) is scoped to a branch.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| restaurant_id | UUID FK | Parent restaurant |
| name | VARCHAR(255) | Branch name (e.g. "Connaught Place") |
| address | TEXT | Physical address |
| phone | VARCHAR(50) | Branch contact |
| latitude | NUMERIC(10,8) | GPS latitude |
| longitude | NUMERIC(11,8) | GPS longitude |
| is_active | BOOLEAN | Operational status |
| deleted_at | TIMESTAMPTZ | Soft delete |

**Indexes:** `restaurant_id`, `name`, `is_active`

> **SaaS Note:** Even single-restaurant deployments should use branches. The schema supports unlimited branches per restaurant with zero refactoring.

---

### RBAC (Role-Based Access Control)

#### `users`
Staff accounts — waiters, chefs, managers, admins. Not to be confused with `customers`.

| Column | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | VARCHAR(255) UNIQUE | Login identifier |
| password_hash | VARCHAR(255) | bcrypt hash |
| first_name | VARCHAR(100) | First name |
| last_name | VARCHAR(100) | Last name |
| phone | VARCHAR(50) | Optional contact |
| is_active | BOOLEAN | Account status |
| is_superadmin | BOOLEAN | Bypass all permission checks |
| deleted_at | TIMESTAMPTZ | Soft delete |

**Indexes:** `email` (unique), `phone`

---

#### `roles`
Named role definitions (e.g. `waiter`, `chef`, `branch_manager`, `admin`).

| Column | Type | Description |
|---|---|---|
| code | VARCHAR(50) UNIQUE | Machine-readable key |
| is_system | BOOLEAN | Prevents deletion of built-in roles |

---

#### `permissions`
Granular permission codes scoped to modules (e.g. `menu:create`, `order:view`, `billing:refund`).

| Column | Type | Description |
|---|---|---|
| code | VARCHAR(100) UNIQUE | Permission identifier |
| module | VARCHAR(50) | Grouping (menu, order, billing) |

---

#### `role_permissions`
Junction table assigning permissions to roles.

**Unique Constraint:** `(role_id, permission_id)` — prevents duplicate grants.

---

#### `user_roles`
Assigns a role to a user, optionally scoped to a specific branch.

**Unique Constraint:** `(user_id, role_id, branch_id)` — a user cannot have the same role twice at the same branch.

> **Design Note:** Branch scoping allows a user to be a `waiter` at Branch A and a `manager` at Branch B simultaneously.

---

### Customers

#### `customers`
Public-facing customer profiles. Separate from `users` by design — customers are not staff.

| Column | Type | Description |
|---|---|---|
| email | VARCHAR(255) UNIQUE | Optional — for registered customers |
| phone | VARCHAR(50) UNIQUE | Optional — for registered customers |
| avatar_url | VARCHAR(1024) | Profile image |

> **Design Note:** Both `email` and `phone` are nullable. A customer can place orders as a guest with no registration whatsoever.

---

#### `guest_sessions`
Short-lived session tokens enabling orderless guests to browse menus and place orders without creating an account.

| Column | Type | Description |
|---|---|---|
| session_token | VARCHAR(255) UNIQUE | Random token (UUID or HMAC) |
| table_id | UUID FK | Table they are seated at |
| customer_id | UUID FK NULL | Optionally linked to a registered customer |
| expires_at | TIMESTAMPTZ | Session expiry |

**Indexes:** `session_token`, `is_active`

---

#### `customer_accounts`
OAuth provider links (Google, Apple, Facebook) for registered customers.

**Unique Constraint:** `(provider, provider_user_id)` — one account per provider per user.

---

### Tables & Queue

#### `dining_tables`
Physical table definitions per branch.

| Column | Type | Description |
|---|---|---|
| table_number | VARCHAR(50) | Human-readable (e.g. "T-12") |
| capacity | INTEGER | Maximum seating |
| status | VARCHAR(50) | `available`, `occupied`, `reserved`, `cleaning` |
| qr_identifier | VARCHAR(255) UNIQUE | UUID embedded in QR code for scan-to-order |
| location_description | TEXT | Section hint (e.g. "Outdoor Terrace") |

**Unique Constraint:** `(branch_id, table_number)` — no duplicate table numbers per branch.

---

#### `queue_entries`
Waitlist management for walk-in guests.

| Column | Type | Description |
|---|---|---|
| guest_count | INTEGER | Party size |
| status | VARCHAR(50) | `waiting`, `seated`, `cancelled`, `no_show` |
| current_position | INTEGER | Rank in queue |
| estimated_wait_minutes | INTEGER | Predicted wait |
| joined_at | TIMESTAMPTZ | Entry time |

**Indexes:** `branch_id`, `status`, `customer_phone`

---

### Menu

#### `categories`
Hierarchical menu sections (Starters, Mains, Desserts, Beverages).

**Indexes:** `branch_id`, `slug`, `is_active`

---

#### `menu_items`
Individual food/beverage offerings.

| Column | Type | Description |
|---|---|---|
| price | NUMERIC(10,2) | Selling price |
| cost_price | NUMERIC(10,2) | Internal cost (for margin calculation) |
| is_vegetarian / is_vegan / is_gluten_free | BOOLEAN | Dietary flags |
| preparation_time_minutes | INTEGER | Kitchen estimate |

**Indexes:** `category_id`, `branch_id`, `name`, `is_available`

---

#### `menu_item_images`
Supports multiple images per item with ordering. `is_primary` marks the thumbnail.

---

#### `menu_item_categories`
Junction table allowing a single item to appear in multiple categories (e.g. "Paneer Tikka" in both "Starters" and "Vegetarian").

**Unique Constraint:** `(menu_item_id, category_id)`

---

### Recipe & Inventory

#### `ingredient_categories`
Classification for raw materials (Dairy, Produce, Dry Goods, Meat).

---

#### `ingredients`
Raw materials with live stock tracking.

| Column | Type | Description |
|---|---|---|
| unit_of_measure | VARCHAR(50) | `kg`, `litre`, `pcs`, `grams` |
| current_stock | NUMERIC(12,3) | Current quantity on hand |
| minimum_stock | NUMERIC(12,3) | Alert threshold |
| reorder_level | NUMERIC(12,3) | Procurement trigger level |
| unit_cost | NUMERIC(10,2) | Cost per unit |

---

#### `recipes`
Defines the ingredient composition for producing a menu item.

---

#### `recipe_ingredients`
Junction table specifying quantity of each ingredient per recipe.

> **Design Note:** `ondelete="RESTRICT"` on `ingredient_id` prevents deleting an ingredient still referenced in active recipes.

---

#### `purchase_history`
Supplier purchase receipts for stock replenishment.

---

#### `stock_history`
Append-only ledger recording all stock movements (purchases, usage, adjustments, waste).

---

#### `waste_records`
Tracks food waste with cost impact for loss reporting.

---

### Orders

#### `orders`
The central transaction entity linking a branch, table, customer/guest, and waiter.

| Column | Type | Description |
|---|---|---|
| order_number | VARCHAR(50) UNIQUE | Human-readable (e.g. "ORD-20260725-0042") |
| order_type | VARCHAR(50) | `dine_in`, `takeaway`, `delivery` |
| status | VARCHAR(50) | `pending → confirmed → preparing → ready → served → completed` |
| total_amount | NUMERIC(10,2) | Pre-discount subtotal |
| tax_amount | NUMERIC(10,2) | Calculated tax |
| discount_amount | NUMERIC(10,2) | Applied discounts |
| final_amount | NUMERIC(10,2) | Amount payable |

**Composite Indexes:** `(branch_id, status)`, `(branch_id, created_at)` — optimizes kitchen dashboard queries.

---

#### `order_items`
Line items within an order, snapshotting the `unit_price` at time of order (price-change safe).

> **Design Note:** Price is snapshotted at order time, not derived from `menu_items.price`. This ensures historical billing accuracy even if menu prices change.

---

#### `order_status_history`
Complete audit trail of every status transition with actor and timestamp.

---

#### `kitchen_tickets`
KDS (Kitchen Display System) tickets, one per preparation station per order. Allows parallel kitchen workflows.

---

#### `special_instructions`
Per-item customizations (e.g. "no onions", "extra spicy", "nut-free") with optional extra cost.

---

### Billing

#### `bills`
Financial summary document generated from an order.

| Column | Type | Description |
|---|---|---|
| bill_number | VARCHAR(50) UNIQUE | Human-readable bill ID |
| subtotal | NUMERIC(10,2) | Pre-tax, pre-discount total |
| tax_amount | NUMERIC(10,2) | GST/VAT amount |
| discount_amount | NUMERIC(10,2) | Total savings |
| tip_amount | NUMERIC(10,2) | Optional gratuity |
| total_amount | NUMERIC(10,2) | Final payable |
| status | VARCHAR(50) | `unpaid`, `partially_paid`, `paid`, `refunded` |

---

#### `bill_items`
Snapshot of order items within a bill. Denormalized for billing immutability.

---

#### `payments`
Individual payment settlement records. A bill can have multiple partial payments.

| Column | Type | Description |
|---|---|---|
| payment_method | VARCHAR(50) | `cash`, `card`, `upi`, `online` |
| payment_gateway | VARCHAR(50) | `stripe`, `razorpay`, `square` |
| transaction_reference | VARCHAR(255) UNIQUE | Gateway transaction ID |
| status | VARCHAR(50) | `pending`, `completed`, `failed`, `refunded` |

---

#### `invoices`
Tax invoice metadata with PDF storage reference.

---

#### `coupons`
Promotional discount codes with validity windows and usage limits.

| Column | Type | Description |
|---|---|---|
| code | VARCHAR(50) UNIQUE | Coupon code |
| discount_type | VARCHAR(50) | `percentage` or `fixed_amount` |
| min_order_amount | NUMERIC(10,2) | Minimum cart value |
| usage_limit | INTEGER | Max uses (NULL = unlimited) |

---

#### `discounts`
Applied discount records per bill, referencing optional coupon.

---

### Reviews

#### `reviews`
Customer ratings (1–5 stars) with optional comment, linked to a branch and order.

**Check Constraint (recommended):** `rating BETWEEN 1 AND 5`

---

#### `review_images`
Multiple photos attached to a review.

---

#### `review_reactions`
Staff or customer reactions to reviews (`like`, `helpful`, `flag`).

---

### Loyalty

#### `reward_points`
Running balance ledger per customer. One-to-one with `customers`.

---

#### `reward_transactions`
Append-only transaction log for point events (earned/redeemed/expired/adjusted).

---

#### `customer_coupons`
Personal coupon assignments, tracking usage status.

---

### Notifications

#### `notifications`
Multi-recipient notification store supporting all staff roles and customers.

| Column | Type | Description |
|---|---|---|
| recipient_type | VARCHAR(50) | `customer`, `waiter`, `kitchen`, `manager`, `admin` |
| notification_type | VARCHAR(100) | `order_update`, `waitlist_alert`, `low_stock`, `system` |
| status | VARCHAR(50) | `unread`, `read`, `archived` |
| payload_json | JSONB | Structured context (e.g. order_id, table_number) |

**Indexes:** `recipient_type`, `status`, `recipient_user_id`, `recipient_customer_id`

---

### Audit

#### `audit_logs`
Generic immutable event log for compliance and security.

| Column | Type | Description |
|---|---|---|
| action | VARCHAR(100) | `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `EXPORT` |
| entity | VARCHAR(100) | Table name (e.g. `orders`, `users`) |
| entity_id | UUID | ID of the affected record |
| old_value | JSONB | State before change |
| new_value | JSONB | State after change |
| ip_address | VARCHAR(50) | Client IP |
| user_agent | VARCHAR(500) | Browser/client info |
| timestamp | TIMESTAMPTZ | Indexed for time-range queries |

> **Design Note:** `audit_logs` never has soft delete. Records are immutable by design.

---

## Indexing Strategy

| Table | Index | Reason |
|---|---|---|
| `restaurants` | `name`, `is_active` | Menu listing and tenant lookup |
| `branches` | `restaurant_id` | All branch-scoped queries |
| `users` | `email` (unique) | Login lookup |
| `orders` | `branch_id`, `status` | Kitchen dashboard, branch reporting |
| `orders` | `order_number` | Customer receipt lookup |
| `order_items` | `order_id` | Join to parent order |
| `guest_sessions` | `session_token` | Per-request session validation |
| `menu_items` | `category_id`, `is_available` | Menu rendering |
| `notifications` | `recipient_*_id`, `status` | Inbox polling |
| `audit_logs` | `timestamp`, `entity`, `action` | SIEM and compliance queries |

**Composite Indexes recommended for production:**
- `orders(branch_id, status, created_at)` — for time-filtered kitchen/reporting views
- `notifications(recipient_user_id, status)` — for fast unread counts
- `stock_history(ingredient_id, created_at)` — for stock trend analysis

---

## Relationship Map

```
Restaurant (1) ──── (N) Branch
Branch     (1) ──── (N) DiningTable
Branch     (1) ──── (N) Category
Branch     (1) ──── (N) Order
Branch     (1) ──── (N) QueueEntry
Branch     (1) ──── (N) Review

User       (N) ──── (N) Role        via user_roles (+ branch scope)
Role       (N) ──── (N) Permission  via role_permissions

Customer   (1) ──── (N) GuestSession
Customer   (1) ──── (N) Order
Customer   (1) ──── (1) RewardPoint
Customer   (1) ──── (N) CustomerCoupon
Customer   (1) ──── (N) CustomerAccount

GuestSession (1) ── (N) Order

Order      (1) ──── (N) OrderItem
Order      (1) ──── (N) OrderStatusHistory
Order      (1) ──── (N) KitchenTicket
Order      (1) ──── (N) Bill

OrderItem  (1) ──── (N) SpecialInstruction
OrderItem  (1) ──── (1) BillItem

Bill       (1) ──── (N) Payment
Bill       (1) ──── (N) Invoice
Bill       (1) ──── (N) Discount

Coupon     (1) ──── (N) Discount
Coupon     (1) ──── (N) CustomerCoupon

MenuItem   (1) ──── (N) MenuItemImage
MenuItem   (N) ──── (N) Category     via menu_item_categories
MenuItem   (1) ──── (N) Recipe
Recipe     (N) ──── (N) Ingredient   via recipe_ingredients

Ingredient (1) ──── (N) PurchaseHistory
Ingredient (1) ──── (N) StockHistory
Ingredient (1) ──── (N) WasteRecord

RewardPoint (1) ─── (N) RewardTransaction
Review      (1) ─── (N) ReviewImage
Review      (1) ─── (N) ReviewReaction
```

---

## Normalization Decisions

| Normalized Away From | Into | Reason |
|---|---|---|
| `user.role = "waiter"` | `UserRole + Role + Permission` | Proper RBAC; roles are composable and branch-scoped |
| `order.customer_email` | `Customer + GuestSession` | Supports guest orders, avoids data duplication |
| `menu_item.category = "Starters"` | `Category + MenuItemCategory` | Items can belong to multiple categories |
| `order_item.ingredient_list` | `Recipe + RecipeIngredient` | Stock deductions require per-ingredient quantities |
| `bill.item_details` (JSON blob) | `BillItem` | Enables per-item refunds and itemized receipts |
| `notification.user_type + user_id` | `recipient_type + recipient_user_id / recipient_customer_id` | Single table handles all recipient types cleanly |
