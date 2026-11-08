import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Protocol

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from pymongo.collection import Collection
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .database import get_collection
from .schemas import ObjectIdString

logger = logging.getLogger(__name__)


class NotificationEvent(str, Enum):
    ASSIGNMENT_COMPLETED = "assignment_completed"
    WEEKLY_REPORT = "weekly_report"


class NotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    student_id: ObjectIdString
    event_id: str = Field(min_length=1, max_length=200)
    event_type: NotificationEvent
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=500)


class NotificationProvider(Protocol):
    def send(self, parent: dict, job: dict) -> None: ...


CollectionDependency = Annotated[Collection, Depends(get_collection)]


def get_notification_provider() -> NotificationProvider | None:
    return None


def queue_notification(
    db,
    student_id: str,
    event_id: str,
    event_type: str,
    title: str,
    body: str,
    now: datetime | None = None,
) -> dict | None:
    student_object_id = ObjectId(student_id)
    parent = db.parents.find_one(
        {"studentId": student_object_id, "restricted": {"$ne": True}},
        {"_id": 1},
    )
    if parent is None:
        return None

    timestamp = now or datetime.now(timezone.utc)
    jobs = db.notification_jobs
    try:
        jobs.update_one(
            {"event_id": event_id},
            {"$setOnInsert": {
                "event_id": event_id,
                "student_id": student_id,
                "parent_id": parent["_id"],
                "event_type": event_type,
                "title": title,
                "body": body,
                "status": "queued",
                "provider": None,
                "created_at": timestamp,
                "updated_at": timestamp,
            }},
            upsert=True,
        )
    except DuplicateKeyError:
        pass
    job = jobs.find_one({"event_id": event_id})
    if job is None:
        raise RuntimeError("Notification job could not be persisted")
    if job["student_id"] != student_id or job["parent_id"] != parent["_id"]:
        raise HTTPException(status_code=409, detail="Notification event ID is already in use")
    return job


def dispatch_notification(db, job: dict | None, provider: NotificationProvider | None) -> dict:
    if job is None:
        return {"status": "skipped", "reason": "No active linked parent"}
    if job["status"] == "sent":
        return {"status": "sent", "job_id": str(job["_id"])}
    if provider is None:
        if job["status"] == "failed":
            return {"status": "failed", "reason": "The previous delivery attempt failed",
                    "job_id": str(job["_id"])}
        return {"status": job["status"], "reason": "No notification provider is configured",
                "job_id": str(job["_id"])}

    claimed = db.notification_jobs.find_one_and_update(
        {"_id": job["_id"], "status": {"$in": ["queued", "failed"]}},
        {"$set": {"status": "sending", "updated_at": datetime.now(timezone.utc)}},
        return_document=ReturnDocument.AFTER,
    )
    if claimed is None:
        latest = db.notification_jobs.find_one({"_id": job["_id"]})
        return {"status": latest["status"], "job_id": str(job["_id"])}

    parent = db.parents.find_one({"_id": claimed["parent_id"]})
    if parent is None:
        reason = "The linked parent account is no longer available"
        db.notification_jobs.update_one(
            {"_id": claimed["_id"], "status": "sending"},
            {"$set": {"status": "failed", "error": reason,
                      "updated_at": datetime.now(timezone.utc)}},
        )
        return {"status": "failed", "reason": reason, "job_id": str(job["_id"])}
    try:
        provider.send(parent, claimed)
    except Exception as error:
        logger.exception("Notification delivery failed for event %s", claimed["event_id"])
        db.notification_jobs.update_one(
            {"_id": claimed["_id"], "status": "sending"},
            {"$set": {"status": "failed", "error": str(error)[:300],
                      "updated_at": datetime.now(timezone.utc)}},
        )
        return {"status": "failed", "reason": "Notification provider delivery failed",
                "job_id": str(job["_id"])}

    db.notification_jobs.update_one(
        {"_id": claimed["_id"], "status": "sending"},
        {"$set": {"status": "sent", "provider": provider.__class__.__name__,
                  "sent_at": datetime.now(timezone.utc),
                  "updated_at": datetime.now(timezone.utc)},
         "$unset": {"error": ""}},
    )
    return {"status": "sent", "job_id": str(job["_id"])}


def create_notification_router(
    provider: NotificationProvider | None = None,
) -> APIRouter:
    notification_router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

    @notification_router.post("/send", status_code=status.HTTP_202_ACCEPTED)
    def send_notification(payload: NotificationRequest, collection: CollectionDependency):
        db = collection.database
        job = queue_notification(
            db,
            payload.student_id,
            payload.event_id,
            payload.event_type.value,
            payload.title,
            payload.body,
        )
        if job is None:
            return {"status": "skipped", "reason": "No active linked parent"}

        result = dispatch_notification(db, job, provider)
        if result["status"] == "failed":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=result["reason"],
            )
        return result

    return notification_router


router = create_notification_router()
