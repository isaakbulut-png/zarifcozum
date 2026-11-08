import logging
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Annotated
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from .database import get_collection
from .models import ParentReport
from .notifications import (
    NotificationProvider,
    dispatch_notification,
    queue_notification,
)
from .schemas import ObjectIdString

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/parents", tags=["parent reports"])
LOCAL_ZONE = ZoneInfo("Europe/Istanbul")
COMPLETED_ASSIGNMENT_STATUSES = ("Teslim edildi", "Geç teslim", "Kontrol edildi")
LEARNING_GAP_THRESHOLD = 60
CollectionDependency = Annotated[Collection, Depends(get_collection)]


def weekly_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    reference = now or datetime.now(timezone.utc)
    if reference.tzinfo is None or reference.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    local_now = reference.astimezone(LOCAL_ZONE)
    monday = local_now.date() - timedelta(days=local_now.weekday() + 7)
    start = datetime.combine(monday, time.min, tzinfo=LOCAL_ZONE)
    end = start + timedelta(days=7)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def _performance_summary(db, student_id: str, start: datetime, end: datetime) -> tuple[float | None, list[dict]]:
    correct_total = 0
    answer_total = 0
    outcome_totals: dict[ObjectId, list[int]] = defaultdict(lambda: [0, 0])
    results = db.quiz_sonuclari.find(
        {"studentId": student_id, "createdAt": {"$gte": start, "$lt": end}},
        {"performance": 1},
    )
    for result in results:
        performance = result.get("performance")
        if not isinstance(performance, list):
            continue
        for item in performance:
            if not isinstance(item, dict) or not isinstance(item.get("correct"), bool):
                continue
            correct = item["correct"]
            answer_total += 1
            correct_total += int(correct)
            node_id = item.get("curriculum_node_id")
            if isinstance(node_id, ObjectId):
                outcome_totals[node_id][0] += int(correct)
                outcome_totals[node_id][1] += 1

    if answer_total == 0:
        return None, []

    eligible_ids = [
        node_id for node_id, (correct, total) in outcome_totals.items()
        if total and correct * 100 < LEARNING_GAP_THRESHOLD * total
    ]
    nodes = db.curriculum_nodes.find(
        {"_id": {"$in": eligible_ids}, "node_type": "KAZANIM_CIKTI", "is_active": True},
        {"title": 1, "code": 1},
    )
    gaps = []
    for node in nodes:
        correct, total = outcome_totals[node["_id"]]
        gaps.append({
            "curriculum_node_id": str(node["_id"]),
            "title": node.get("title", ""),
            "code": node.get("code", ""),
            "success_percent": round(correct * 100 / total, 2),
        })
    gaps.sort(key=lambda gap: (gap["success_percent"], gap["curriculum_node_id"]))
    average = round(correct_total * 100 / answer_total, 2)
    return average, gaps[:2]


def _notify_report_ready(db, student_id: str, week_start: datetime,
                         provider: NotificationProvider | None) -> None:
    event_id = f"weekly-report:{student_id}:{week_start.astimezone(LOCAL_ZONE).date().isoformat()}"
    job = db.notification_jobs.find_one({"event_id": event_id})
    if job is None:
        job = queue_notification(
            db,
            student_id,
            event_id,
            "weekly_report",
            "Haftalık öğrenme karneniz hazır",
            "Öğrencinizin haftalık öğrenme karnesi görüntülenmeye hazır.",
        )
    result = dispatch_notification(db, job, provider)
    if result["status"] == "failed":
        logger.error("Weekly report notification failed for student %s: %s",
                     student_id, result.get("reason", "Unknown error"))


def build_weekly_report(
    db,
    student_id: str,
    now: datetime | None = None,
    provider: NotificationProvider | None = None,
) -> tuple[dict, bool]:
    start, end = weekly_window(now)
    collection = db.parent_reports
    report_filter = {"student_id": student_id, "week_start": start}
    existing = collection.find_one(report_filter)
    if existing is not None:
        _notify_report_ready(db, student_id, start, provider)
        return existing, False

    completed_assignments = db.odev_atamalari.count_documents({
        "studentUserId": student_id,
        "status": {"$in": COMPLETED_ASSIGNMENT_STATUSES},
        "submittedAt": {"$gte": start, "$lt": end},
    })
    average, gaps = _performance_summary(db, student_id, start, end)
    generated_at = datetime.now(timezone.utc)
    report = ParentReport(
        student_id=student_id,
        week_start=start,
        week_end=end,
        completed_assignments=completed_assignments,
        average_success_percent=average,
        critical_gaps=gaps,
        generated_at=generated_at,
    )
    try:
        result = collection.update_one(
            report_filter,
            {"$setOnInsert": report.document()},
            upsert=True,
        )
        created = result.upserted_id is not None
    except DuplicateKeyError:
        created = False
    saved = collection.find_one({"student_id": student_id, "week_start": start})
    if saved is None:
        logger.error("Parent report upsert produced no document for student %s", student_id)
        raise RuntimeError("Parent report could not be persisted")
    _notify_report_ready(db, student_id, start, provider)
    return saved, created


def create_parent_reports_router(
    provider: NotificationProvider | None = None,
) -> APIRouter:
    parent_reports_router = APIRouter(prefix="/api/v1/parents", tags=["parent reports"])

    @parent_reports_router.get("/{student_id}/report")
    def get_parent_report(student_id: ObjectIdString, collection: CollectionDependency):
        report, _ = build_weekly_report(collection.database, student_id, provider=provider)
        return {
            "id": str(report["_id"]),
            "student_id": report["student_id"],
            "week_start": report["week_start"],
            "week_end": report["week_end"],
            "completed_assignments": report["completed_assignments"],
            "average_success_percent": report["average_success_percent"],
            "critical_gaps": report["critical_gaps"],
            "generated_at": report["generated_at"],
        }

    return parent_reports_router


router = create_parent_reports_router()
