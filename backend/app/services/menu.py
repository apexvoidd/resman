"""
Service layer for Category and Menu Item CRUD, filtering, sorting, and public customer menu browsing.
"""

import math
import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import Category, MenuItem
from app.models.restaurant import Branch, Restaurant
from app.models.review import Review
from app.schemas.menu import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    MenuItemCreate,
    MenuItemListResponse,
    MenuItemOut,
    MenuItemUpdate,
)


def _slugify(text: str) -> str:
    """Generate a clean URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[-\s]+", "-", text)


def _build_category_out(category: Category) -> CategoryOut:
    """Map Category ORM model to CategoryOut DTO."""
    return CategoryOut(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        display_order=category.display_order,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )


def _build_menu_item_out(
    item: MenuItem, avg_rating: float | None = None, total_ratings: int = 0
) -> MenuItemOut:
    """Map MenuItem ORM model to MenuItemOut DTO."""
    return MenuItemOut(
        id=item.id,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        name=item.name,
        description=item.description,
        price=float(item.price),
        preparation_time_minutes=item.preparation_time_minutes,
        image_url=item.image_url,
        is_available=item.is_available,
        is_featured=item.is_featured,
        is_vegetarian=item.is_vegetarian,
        is_vegan=item.is_vegan,
        is_jain=item.is_jain,
        spicy_level=item.spicy_level,
        display_order=item.display_order,
        average_rating=avg_rating,
        total_ratings=total_ratings,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def get_or_create_default_branch(db: AsyncSession) -> Branch:
    """Fetch default active branch."""
    result = await db.execute(select(Branch).where(Branch.is_active.is_(True)).limit(1))
    branch = result.scalar_one_or_none()
    if branch is not None:
        return branch

    res_result = await db.execute(
        select(Restaurant).where(Restaurant.is_active.is_(True)).limit(1)
    )
    restaurant = res_result.scalar_one_or_none()
    if restaurant is None:
        restaurant = Restaurant(
            name="Main Restaurant",
            currency="INR",
            timezone="Asia/Kolkata",
            is_active=True,
        )
        db.add(restaurant)
        await db.flush()

    branch = Branch(
        restaurant_id=restaurant.id,
        name="Main Branch",
        is_active=True,
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


# --- CATEGORY SERVICES ---


async def get_category_list(
    db: AsyncSession, *, is_active: bool | None = None
) -> list[CategoryOut]:
    """Fetch non-deleted categories sorted by display_order."""
    branch = await get_or_create_default_branch(db)
    query = select(Category).where(
        Category.branch_id == branch.id,
        Category.deleted_at.is_(None),
    )

    if is_active is not None:
        query = query.where(Category.is_active.is_(is_active))

    query = query.order_by(Category.display_order.asc(), Category.name.asc())
    result = await db.execute(query)
    categories = result.scalars().all()
    return [_build_category_out(c) for c in categories]


async def create_category(db: AsyncSession, payload: CategoryCreate) -> CategoryOut:
    """Create a new menu category."""
    branch = await get_or_create_default_branch(db)
    slug = _slugify(payload.name)

    existing = await db.execute(
        select(Category).where(
            Category.branch_id == branch.id,
            Category.name.ilike(payload.name),
            Category.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category with name '{payload.name}' already exists.",
        )

    category = Category(
        branch_id=branch.id,
        name=payload.name,
        slug=slug,
        description=payload.description,
        display_order=payload.display_order,
        is_active=payload.is_active,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return _build_category_out(category)


async def update_category(
    db: AsyncSession, category_id: uuid.UUID, payload: CategoryUpdate
) -> CategoryOut:
    """Update an existing category."""
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.deleted_at.is_(None)
        )
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found.",
        )

    if payload.name:
        category.name = payload.name
        category.slug = _slugify(payload.name)
    if payload.description is not None:
        category.description = payload.description
    if payload.display_order is not None:
        category.display_order = payload.display_order
    if payload.is_active is not None:
        category.is_active = payload.is_active

    await db.commit()
    await db.refresh(category)
    return _build_category_out(category)


async def toggle_category_status(
    db: AsyncSession, category_id: uuid.UUID, is_active: bool
) -> CategoryOut:
    """Enable or disable a category."""
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.deleted_at.is_(None)
        )
    )
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found.",
        )

    category.is_active = is_active
    await db.commit()
    await db.refresh(category)
    return _build_category_out(category)


# --- MENU ITEM SERVICES ---


async def get_menu_item_list(
    db: AsyncSession,
    *,
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    is_available: bool | None = None,
    is_vegetarian: bool | None = None,
    is_vegan: bool | None = None,
    is_jain: bool | None = None,
    sort_by_price: str | None = None,  # "asc" or "desc"
    page: int = 1,
    page_size: int = 20,
) -> MenuItemListResponse:
    """
    Fetch paginated menu items with search, category, availability, dietary filters, and price sorting.
    """
    branch = await get_or_create_default_branch(db)
    query = (
        select(MenuItem)
        .options(selectinload(MenuItem.category))
        .where(
            MenuItem.branch_id == branch.id,
            MenuItem.deleted_at.is_(None),
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            (MenuItem.name.ilike(term)) | (MenuItem.description.ilike(term))
        )

    if category_id:
        query = query.where(MenuItem.category_id == category_id)

    if is_available is not None:
        query = query.where(MenuItem.is_available.is_(is_available))

    if is_vegetarian:
        query = query.where(MenuItem.is_vegetarian.is_(True))

    if is_vegan:
        query = query.where(MenuItem.is_vegan.is_(True))

    if is_jain:
        query = query.where(MenuItem.is_jain.is_(True))

    # Sorting
    if sort_by_price == "asc":
        query = query.order_by(MenuItem.price.asc())
    elif sort_by_price == "desc":
        query = query.order_by(MenuItem.price.desc())
    else:
        query = query.order_by(MenuItem.display_order.asc(), MenuItem.name.asc())

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    item_ids = [i.id for i in items]
    ratings_map: dict[uuid.UUID, tuple[float | None, int]] = {}
    if item_ids:
        ratings_res = await db.execute(
            select(
                Review.menu_item_id,
                func.avg(Review.rating).label("avg_rating"),
                func.count(Review.id).label("total_ratings"),
            )
            .where(
                Review.menu_item_id.in_(item_ids),
                Review.deleted_at.is_(None),
                Review.is_hidden.is_(False),
            )
            .group_by(Review.menu_item_id)
        )
        for row in ratings_res.all():
            if row.menu_item_id and row.avg_rating is not None:
                ratings_map[row.menu_item_id] = (
                    round(float(row.avg_rating), 1),
                    int(row.total_ratings or 0),
                )

    item_dtos = [
        _build_menu_item_out(
            i,
            avg_rating=ratings_map.get(i.id, (None, 0))[0],
            total_ratings=ratings_map.get(i.id, (None, 0))[1],
        )
        for i in items
    ]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return MenuItemListResponse(
        items=item_dtos,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_menu_item_by_id(db: AsyncSession, item_id: uuid.UUID) -> MenuItemOut:
    """Fetch a single menu item by ID."""
    result = await db.execute(
        select(MenuItem)
        .options(selectinload(MenuItem.category))
        .where(MenuItem.id == item_id, MenuItem.deleted_at.is_(None))
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item '{item_id}' not found.",
        )
    
    rating_res = await db.execute(
        select(
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("total_ratings"),
        ).where(
            Review.menu_item_id == item_id,
            Review.deleted_at.is_(None),
            Review.is_hidden.is_(False),
        )
    )
    r_row = rating_res.first()
    avg_r = round(float(r_row.avg_rating), 1) if r_row and r_row.avg_rating else None
    tot_r = int(r_row.total_ratings) if r_row and r_row.total_ratings else 0

    return _build_menu_item_out(item, avg_rating=avg_r, total_ratings=tot_r)


async def create_menu_item(db: AsyncSession, payload: MenuItemCreate) -> MenuItemOut:
    """Create a new menu item."""
    branch = await get_or_create_default_branch(db)

    # Verify category exists
    cat_res = await db.execute(
        select(Category).where(
            Category.id == payload.category_id, Category.deleted_at.is_(None)
        )
    )
    category = cat_res.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID '{payload.category_id}' not found.",
        )

    item = MenuItem(
        branch_id=branch.id,
        category_id=payload.category_id,
        name=payload.name,
        description=payload.description,
        price=payload.price,
        preparation_time_minutes=payload.preparation_time_minutes,
        image_url=payload.image_url,
        is_available=payload.is_available,
        is_featured=payload.is_featured,
        is_vegetarian=payload.is_vegetarian,
        is_vegan=payload.is_vegan,
        is_jain=payload.is_jain,
        spicy_level=payload.spicy_level,
        display_order=payload.display_order,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    await db.refresh(item, ["category"])
    return _build_menu_item_out(item)


async def update_menu_item(
    db: AsyncSession, item_id: uuid.UUID, payload: MenuItemUpdate
) -> MenuItemOut:
    """Update an existing menu item."""
    result = await db.execute(
        select(MenuItem)
        .options(selectinload(MenuItem.category))
        .where(MenuItem.id == item_id, MenuItem.deleted_at.is_(None))
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item '{item_id}' not found.",
        )

    if payload.category_id:
        cat_res = await db.execute(
            select(Category).where(
                Category.id == payload.category_id, Category.deleted_at.is_(None)
            )
        )
        if cat_res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with ID '{payload.category_id}' not found.",
            )
        item.category_id = payload.category_id

    if payload.name is not None:
        item.name = payload.name
    if payload.description is not None:
        item.description = payload.description
    if payload.price is not None:
        item.price = payload.price
    if payload.preparation_time_minutes is not None:
        item.preparation_time_minutes = payload.preparation_time_minutes
    if payload.image_url is not None:
        item.image_url = payload.image_url
    if payload.is_available is not None:
        item.is_available = payload.is_available
    if payload.is_featured is not None:
        item.is_featured = payload.is_featured
    if payload.is_vegetarian is not None:
        item.is_vegetarian = payload.is_vegetarian
    if payload.is_vegan is not None:
        item.is_vegan = payload.is_vegan
    if payload.is_jain is not None:
        item.is_jain = payload.is_jain
    if payload.spicy_level is not None:
        item.spicy_level = payload.spicy_level
    if payload.display_order is not None:
        item.display_order = payload.display_order

    await db.commit()
    await db.refresh(item)
    await db.refresh(item, ["category"])
    return _build_menu_item_out(item)


async def toggle_menu_item_availability(
    db: AsyncSession, item_id: uuid.UUID, is_available: bool
) -> MenuItemOut:
    """Toggle menu item availability."""
    result = await db.execute(
        select(MenuItem)
        .options(selectinload(MenuItem.category))
        .where(MenuItem.id == item_id, MenuItem.deleted_at.is_(None))
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item '{item_id}' not found.",
        )

    item.is_available = is_available
    await db.commit()
    await db.refresh(item)
    return _build_menu_item_out(item)


async def delete_menu_item(db: AsyncSession, item_id: uuid.UUID) -> None:
    """Soft delete a menu item."""
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.deleted_at.is_(None))
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item '{item_id}' not found.",
        )

    item.deleted_at = datetime.now(UTC)
    item.is_available = False
    await db.commit()
