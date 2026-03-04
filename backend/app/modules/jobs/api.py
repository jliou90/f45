from __future__ import annotations

from uuid import uuid4

from app.core.auth.deps import get_current_user
from app.core.errors import AppError
from app.core.idempotency import idempotency_guard
from app.core.uow import UnitOfWork
from app.db.session import get_db, get_uow
from app.modules.jobs.models import Job
from app.modules.jobs.schemas import JobCreateRequest, JobOut
from app.modules.tenancy.deps import get_tenant_id
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(get_current_user)])


def _to_job_out(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        tenant_id=job.tenant_id,
        job_type=job.job_type,
        status=job.status,
        progress=int(job.progress or 0),
        result=job.result,
        error=job.error,
        created_by=job.created_by,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.post("/{job_type}", response_model=JobOut)
def create_job(
    job_type: str,
    payload: JobCreateRequest,
    uow: UnitOfWork = Depends(get_uow),
    tenant_id: str = Depends(get_tenant_id),
    user=Depends(get_current_user),
    _idmp=Depends(idempotency_guard),
):
    with uow as db:
        job = Job(
            id=str(uuid4()),
            tenant_id=tenant_id,
            job_type=job_type,
            status="queued",
            progress=0,
            payload=payload.payload,
            created_by=getattr(user, "id", None),
        )
        db.add(job)
        db.flush()
        db.refresh(job)
        return _to_job_out(job)


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
    _user=Depends(get_current_user),
):
    job = (
        db.query(Job)
        .filter(
            Job.tenant_id == tenant_id,
            Job.id == job_id,
        )
        .one_or_none()
    )
    if job is None:
        raise AppError(code="job_not_found", message="Job not found", status_code=404)
    return _to_job_out(job)
