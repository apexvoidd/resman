#!/usr/bin/env python3
"""
Seed script — creates the 6 system roles, their permissions, and
assigns all permissions to Admin.

Run from the backend directory with the virtualenv active:

    python -m scripts.seed_roles

Requires DATABASE_URL to be set in backend/.env
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Make sure the backend package is on the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config.settings import settings
from app.models.staff import Permission, Role, RolePermission

# ─── Role definitions ─────────────────────────────────────────────────────────

ROLES: list[dict] = [
    {
        "name": "Admin",
        "code": "admin",
        "description": "Full system access. Manages all restaurant operations.",
        "is_system": True,
    },
    {
        "name": "Manager",
        "code": "manager",
        "description": "Manages staff, menu, orders and reviews for a branch.",
        "is_system": True,
    },
    {
        "name": "Waiter",
        "code": "waiter",
        "description": "Takes orders, serves tables, handles customer requests.",
        "is_system": True,
    },
    {
        "name": "Kitchen",
        "code": "kitchen",
        "description": "Views and updates kitchen tickets and order preparation status.",
        "is_system": True,
    },
    {
        "name": "Cashier",
        "code": "cashier",
        "description": "Handles billing, payments and invoice generation.",
        "is_system": True,
    },
    {
        "name": "Cleaning Staff",
        "code": "cleaning_staff",
        "description": "Views table status and updates cleaning status.",
        "is_system": True,
    },
]

# ─── Permission definitions ───────────────────────────────────────────────────
# Format: (code, name, module)

PERMISSIONS: list[tuple[str, str, str]] = [
    # restaurant
    ("restaurant:view", "View Restaurant", "restaurant"),
    ("restaurant:edit", "Edit Restaurant", "restaurant"),
    # branch
    ("branch:view", "View Branch", "branch"),
    ("branch:edit", "Edit Branch", "branch"),
    # staff
    ("staff:view", "View Staff", "staff"),
    ("staff:create", "Create Staff", "staff"),
    ("staff:edit", "Edit Staff", "staff"),
    ("staff:delete", "Delete Staff", "staff"),
    # menu
    ("menu:view", "View Menu", "menu"),
    ("menu:create", "Create Menu Item", "menu"),
    ("menu:edit", "Edit Menu Item", "menu"),
    ("menu:delete", "Delete Menu Item", "menu"),
    # order
    ("order:view", "View Orders", "order"),
    ("order:create", "Create Order", "order"),
    ("order:edit", "Edit Order", "order"),
    ("order:cancel", "Cancel Order", "order"),
    ("order:kitchen_update", "Update Kitchen Status", "order"),
    # table
    ("table:view", "View Tables", "table"),
    ("table:edit", "Edit Table Status", "table"),
    ("table:manage", "Manage Tables", "table"),
    # billing
    ("billing:view", "View Bills", "billing"),
    ("billing:create", "Create Bill", "billing"),
    ("billing:payment", "Process Payment", "billing"),
    ("billing:refund", "Issue Refund", "billing"),
    ("billing:invoice", "Generate Invoice", "billing"),
    # inventory
    ("inventory:view", "View Inventory", "inventory"),
    ("inventory:edit", "Edit Inventory", "inventory"),
    ("inventory:purchase", "Record Purchase", "inventory"),
    # review
    ("review:view", "View Reviews", "review"),
    ("review:moderate", "Moderate Reviews", "review"),
    # reports
    ("reports:view", "View Reports", "reports"),
    ("reports:export", "Export Reports", "reports"),
    # notifications
    ("notification:view", "View Notifications", "notification"),
    # audit
    ("audit:view", "View Audit Logs", "audit"),
]

# ─── Role → Permission mapping ────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [p[0] for p in PERMISSIONS],  # all permissions
    "manager": [
        "restaurant:view",
        "branch:view",
        "branch:edit",
        "staff:view",
        "staff:create",
        "staff:edit",
        "menu:view",
        "menu:create",
        "menu:edit",
        "menu:delete",
        "order:view",
        "order:edit",
        "order:cancel",
        "table:view",
        "table:edit",
        "table:manage",
        "billing:view",
        "billing:create",
        "billing:invoice",
        "inventory:view",
        "inventory:edit",
        "inventory:purchase",
        "review:view",
        "review:moderate",
        "reports:view",
        "notification:view",
    ],
    "waiter": [
        "menu:view",
        "order:view",
        "order:create",
        "order:edit",
        "table:view",
        "table:edit",
        "billing:view",
        "notification:view",
    ],
    "kitchen": [
        "menu:view",
        "order:view",
        "order:kitchen_update",
        "inventory:view",
        "notification:view",
    ],
    "cashier": [
        "order:view",
        "billing:view",
        "billing:create",
        "billing:payment",
        "billing:refund",
        "billing:invoice",
        "notification:view",
    ],
    "cleaning_staff": [
        "table:view",
        "table:edit",
        "notification:view",
    ],
}


# ─── Seeding logic ────────────────────────────────────────────────────────────


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        print("🌱 Seeding roles and permissions...")

        # Upsert permissions
        perm_map: dict[str, Permission] = {}
        for code, name, module in PERMISSIONS:
            result = await session.execute(
                select(Permission).where(Permission.code == code)
            )
            perm = result.scalar_one_or_none()
            if perm is None:
                perm = Permission(name=name, code=code, module=module)
                session.add(perm)
                print(f"  ✅ Permission created: {code}")
            else:
                print(f"  ⏭️  Permission exists: {code}")
            perm_map[code] = perm

        await session.flush()

        # Upsert roles and bind permissions
        for role_data in ROLES:
            result = await session.execute(
                select(Role).where(Role.code == role_data["code"])
            )
            role = result.scalar_one_or_none()
            if role is None:
                role = Role(**role_data)
                session.add(role)
                await session.flush()
                print(f"  ✅ Role created: {role_data['code']}")
            else:
                print(f"  ⏭️  Role exists: {role_data['code']}")

            # Bind permissions to role
            for perm_code in ROLE_PERMISSIONS.get(role_data["code"], []):
                perm = perm_map.get(perm_code)
                if perm is None:
                    continue
                existing_rp = await session.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )
                if existing_rp.scalar_one_or_none() is None:
                    session.add(RolePermission(role_id=role.id, permission_id=perm.id))

        await session.commit()
        print("\n✅ Seeding complete.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
