import pytest
from fastapi import HTTPException

from app.services.kds import ALLOWED_TRANSITIONS, _validate_transition


def test_kds_allowed_transitions():
    assert "ready" in ALLOWED_TRANSITIONS["pending"]
    assert "ready" in ALLOWED_TRANSITIONS["accepted"]
    assert "ready" in ALLOWED_TRANSITIONS["preparing"]
    assert "completed" in ALLOWED_TRANSITIONS["ready"]


def test_kds_transition_validation():
    # Valid transitions
    _validate_transition("pending", "accepted")
    _validate_transition("accepted", "preparing")
    _validate_transition("preparing", "ready")
    _validate_transition("ready", "completed")

    # Invalid transitions
    with pytest.raises(HTTPException) as exc_info:
        _validate_transition("pending", "completed")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        _validate_transition("ready", "preparing")
    assert exc_info.value.status_code == 400
