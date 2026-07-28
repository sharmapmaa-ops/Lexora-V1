"""
Generic Admin Panel CRUD.

One set of routes serves every table in AdminRegistry. Column headers,
types, and primary keys are read from SQLAlchemy's own model metadata
(`sqlalchemy.inspect`) rather than re-declared by hand per table - the
exact fix for the old project's Admin Panel, where every table needed
its own hand-written column list and the three separate attempts it
took to get scrolling/height right per table.
"""
import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.api.v1.admin_registry import AdminRegistry, AdminTableSpec
from app.api.v1.deps import get_db, require_roles
from app.models.user import User, UserRole

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles(UserRole.admin, UserRole.developer))])


def _json_safe(value: Any) -> Any:
    if isinstance(value, (uuid.UUID,)):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, enum.Enum):
        return value.value
    return value


def _spec_or_404(name: str) -> AdminTableSpec:
    spec = AdminRegistry.get(name)
    if spec is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"'{name}' is not an admin-manageable table.")
    return spec


def _columns(spec: AdminTableSpec) -> list[dict]:
    mapper = inspect(spec.model)
    cols = []
    for col in mapper.columns:
        if col.key in spec.hidden_fields:
            continue
        cols.append({
            "name": col.key,
            "type": str(col.type),
            "primary_key": col.primary_key,
            "editable": col.key not in spec.readonly_fields and not col.primary_key,
        })
    return cols


def _row_to_dict(spec: AdminTableSpec, row) -> dict:
    mapper = inspect(spec.model)
    return {
        col.key: _json_safe(getattr(row, col.key))
        for col in mapper.columns
        if col.key not in spec.hidden_fields
    }


@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    out = []
    for name, spec in AdminRegistry.all().items():
        count = db.query(spec.model).count()
        out.append({"name": name, "display_name": spec.display_name, "row_count": count})
    return out


@router.get("/tables/{name}")
def get_table(
    name: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    spec = _spec_or_404(name)
    total = db.query(spec.model).count()
    rows = (
        db.query(spec.model)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "columns": _columns(spec),
        "rows": [_row_to_dict(spec, r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/tables/{name}", status_code=status.HTTP_201_CREATED)
def create_row(name: str, payload: dict, db: Session = Depends(get_db)):
    spec = _spec_or_404(name)
    clean = {k: v for k, v in payload.items() if k not in spec.hidden_fields and k not in spec.readonly_fields}
    row = spec.model(**clean)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(spec, row)


@router.put("/tables/{name}/{row_id}")
def update_row(name: str, row_id: str, payload: dict, db: Session = Depends(get_db)):
    spec = _spec_or_404(name)
    row = db.get(spec.model, row_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Row not found.")
    for key, value in payload.items():
        if key in spec.hidden_fields or key in spec.readonly_fields:
            continue
        if hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _row_to_dict(spec, row)


@router.delete("/tables/{name}/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_row(name: str, row_id: str, db: Session = Depends(get_db)):
    spec = _spec_or_404(name)
    row = db.get(spec.model, row_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Row not found.")
    db.delete(row)
    db.commit()
