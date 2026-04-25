"""User profile and run-history routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models import User, PipelineRun
from auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProfileOut(BaseModel):
    id:           int
    username:     str
    email:        str
    display_name: str | None
    created_at:   str
    total_runs:   int

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    email:        EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password:     str


class RunSummary(BaseModel):
    id:                    int
    image_filename:        str | None
    noise_profile:         str
    ocr_text:              str | None
    confidence:            float | None
    compression_ratio:     float | None
    pipeline_latency_ms:   float | None
    created_at:            str

    model_config = {"from_attributes": True}


class RunDetail(RunSummary):
    noise_profile_detected: str | None
    compressed_bytes:       str | None
    original_size_bits:     int | None
    compressed_size_bits:   int | None
    entropy:                float | None
    encoding_efficiency:    float | None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_to_summary(r: PipelineRun) -> dict:
    return {
        "id":                  r.id,
        "image_filename":      r.image_filename,
        "noise_profile":       r.noise_profile,
        "ocr_text":            r.ocr_text,
        "confidence":          r.confidence,
        "compression_ratio":   r.compression_ratio,
        "pipeline_latency_ms": r.pipeline_latency_ms,
        "created_at":          r.created_at.isoformat() if r.created_at else None,
    }


def _run_to_detail(r: PipelineRun) -> dict:
    return {
        **_run_to_summary(r),
        "noise_profile_detected": r.noise_profile_detected,
        "compressed_bytes":       r.compressed_bytes,
        "original_size_bits":     r.original_size_bits,
        "compressed_size_bits":   r.compressed_size_bits,
        "entropy":                r.entropy,
        "encoding_efficiency":    r.encoding_efficiency,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileOut)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.query(PipelineRun).filter(PipelineRun.user_id == current_user.id).count()
    return {
        "id":           current_user.id,
        "username":     current_user.username,
        "email":        current_user.email,
        "display_name": current_user.display_name,
        "created_at":   current_user.created_at.isoformat() if current_user.created_at else None,
        "total_runs":   total,
    }


@router.patch("/me", response_model=ProfileOut)
def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.email and body.email != current_user.email:
        if db.query(User).filter(User.email == body.email, User.id != current_user.id).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
        current_user.email = body.email  # type: ignore[assignment]
    if body.display_name is not None:
        current_user.display_name = body.display_name  # type: ignore[assignment]
    db.commit()
    db.refresh(current_user)

    total = db.query(PipelineRun).filter(PipelineRun.user_id == current_user.id).count()
    return {
        "id":           current_user.id,
        "username":     current_user.username,
        "email":        current_user.email,
        "display_name": current_user.display_name,
        "created_at":   current_user.created_at.isoformat() if current_user.created_at else None,
        "total_runs":   total,
    }


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Password must be at least 8 characters")
    current_user.hashed_password = hash_password(body.new_password)  # type: ignore[assignment]
    db.commit()


@router.get("/me/runs", response_model=list[RunSummary])
def list_runs(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns paginated list of the authenticated user's pipeline runs, newest first."""
    runs = (
        db.query(PipelineRun)
        .filter(PipelineRun.user_id == current_user.id)
        .order_by(PipelineRun.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_run_to_summary(r) for r in runs]


@router.get("/me/runs/{run_id}", response_model=RunDetail)
def get_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.id == run_id, PipelineRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    return _run_to_detail(run)


@router.delete("/me/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = (
        db.query(PipelineRun)
        .filter(PipelineRun.id == run_id, PipelineRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    db.delete(run)
    db.commit()
