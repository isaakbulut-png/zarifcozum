from datetime import datetime, timezone

from .database import ensure_indexes, get_client, get_collection, get_database
from .notifications import NotificationProvider, get_notification_provider
from .parent_reports import build_weekly_report


def generate_all_weekly_reports(
    db,
    now: datetime | None = None,
    provider: NotificationProvider | None = None,
) -> tuple[int, int]:
    reference = now or datetime.now(timezone.utc)
    students = {
        str(parent["studentId"])
        for parent in db.parents.find(
            {"restricted": {"$ne": True}},
            {"studentId": 1},
        )
        if parent.get("studentId") is not None
    }
    created = 0
    for student_id in sorted(students):
        _, was_created = build_weekly_report(db, student_id, reference, provider)
        created += int(was_created)
    return len(students), created


def main() -> None:
    try:
        ensure_indexes(get_collection())
        student_count, report_count = generate_all_weekly_reports(
            get_database(),
            provider=get_notification_provider(),
        )
        print(f"Processed {student_count} linked students; created {report_count} weekly reports.")
    finally:
        if get_client.cache_info().currsize:
            get_client().close()
            get_client.cache_clear()


if __name__ == "__main__":
    main()
