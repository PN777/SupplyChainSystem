from datetime import datetime
from math import isfinite


def is_non_negative_int(value, field_name="value"):
    if value is None:
        raise ValueError(f"{field_name} is required")
    if isinstance(value, bool) or (isinstance(value, float) and not value.is_integer()):
        raise ValueError(f"{field_name} must be an integer")
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer")
    if value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


def is_positive_int(value, field_name="value"):
    value = is_non_negative_int(value, field_name)
    if value == 0:
        raise ValueError(f"{field_name} must be positive")
    return value


def is_non_negative_number(value, field_name="value"):
    if value is None or isinstance(value, bool):
        raise ValueError(f"{field_name} must be a non-negative number")
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a non-negative number")
    if not isfinite(value) or value < 0:
        raise ValueError(f"{field_name} must be a non-negative number")
    return value


def required_text(value, field_name="value", max_length=None):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} is required")
    value = value.strip()
    if max_length is not None and len(value) > max_length:
        raise ValueError(f"{field_name} must be at most {max_length} characters")
    return value


def ensure_valid_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.fromisoformat(str(value)).date()
    except (TypeError, ValueError):
        raise ValueError("Date must be a valid ISO date (YYYY-MM-DD)")
