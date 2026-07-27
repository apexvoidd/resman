from app.services.inventory import DEFAULT_CATEGORIES, _determine_stock_status


def test_determine_stock_status():
    assert _determine_stock_status(0.0, 10.0) == "out_of_stock"
    assert _determine_stock_status(-1.0, 10.0) == "out_of_stock"
    assert _determine_stock_status(5.0, 10.0) == "low_stock"
    assert _determine_stock_status(10.0, 10.0) == "low_stock"
    assert _determine_stock_status(15.0, 10.0) == "in_stock"


def test_default_categories_list():
    assert "Vegetables" in DEFAULT_CATEGORIES
    assert "Dairy" in DEFAULT_CATEGORIES
    assert "Meat" in DEFAULT_CATEGORIES
    assert "Seafood" in DEFAULT_CATEGORIES
    assert "Beverages" in DEFAULT_CATEGORIES
    assert "Spices" in DEFAULT_CATEGORIES
    assert "Bakery" in DEFAULT_CATEGORIES
    assert "Frozen" in DEFAULT_CATEGORIES
    assert "Others" in DEFAULT_CATEGORIES
