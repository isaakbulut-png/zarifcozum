import unittest
from datetime import datetime, timedelta, timezone

import mongomock
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from curriculum_backend.database import get_collection
from curriculum_backend.parent_reports import (
    build_weekly_report,
    router as parent_reports_router,
    weekly_window,
)
from curriculum_backend.weekly_reports import generate_all_weekly_reports


class ParentReportTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().test
        self.student_id = str(ObjectId())
        self.parent_id = ObjectId()
        self.now = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
        self.start, self.end = weekly_window(self.now)
        self.weakest = ObjectId()
        self.second_weakest = ObjectId()
        self.strong = ObjectId()
        self.db.parents.insert_one({"_id": self.parent_id, "studentId": ObjectId(self.student_id)})
        self.db.curriculum_nodes.insert_many([
            {"_id": self.weakest, "node_type": "KAZANIM_CIKTI", "is_active": True,
             "title": "Kesirleri tanıma", "code": "MAT.5.1"},
            {"_id": self.second_weakest, "node_type": "KAZANIM_CIKTI", "is_active": True,
             "title": "Kesirleri karşılaştırma", "code": "MAT.5.2"},
            {"_id": self.strong, "node_type": "KAZANIM_CIKTI", "is_active": True,
             "title": "Kesirleri sıralama", "code": "MAT.5.3"},
        ])
        self.db.odev_atamalari.insert_many([
            {"studentUserId": self.student_id, "status": "Teslim edildi",
             "submittedAt": self.start + timedelta(days=1)},
            {"studentUserId": self.student_id, "status": "Geç teslim",
             "submittedAt": self.end - timedelta(seconds=1)},
            {"studentUserId": self.student_id, "status": "Atandı",
             "submittedAt": self.start + timedelta(days=1)},
            {"studentUserId": self.student_id, "status": "Kontrol edildi",
             "submittedAt": self.start - timedelta(seconds=1)},
        ])
        self.db.quiz_sonuclari.insert_many([
            {
                "studentId": self.student_id,
                "createdAt": self.start + timedelta(days=2),
                "performance": [
                    {"curriculum_node_id": self.weakest, "correct": False},
                    {"curriculum_node_id": self.second_weakest, "correct": False},
                    {"curriculum_node_id": self.second_weakest, "correct": False},
                    {"curriculum_node_id": self.second_weakest, "correct": True},
                    {"curriculum_node_id": self.strong, "correct": True},
                    {"curriculum_node_id": self.strong, "correct": True},
                ],
            },
            {
                "studentId": self.student_id,
                "createdAt": self.start - timedelta(seconds=1),
                "performance": [{"curriculum_node_id": self.strong, "correct": False}],
            },
            {
                "studentId": self.student_id,
                "createdAt": self.end,
                "performance": [{"curriculum_node_id": self.strong, "correct": False}],
            },
        ])

    def test_week_window_uses_monday_midnight_in_istanbul(self):
        self.assertEqual(self.start, datetime(2026, 11, 1, 21, tzinfo=timezone.utc))
        self.assertEqual(self.end, datetime(2026, 11, 8, 21, tzinfo=timezone.utc))
        later_in_week = weekly_window(datetime(2026, 11, 13, 12, tzinfo=timezone.utc))
        self.assertEqual(later_in_week, (self.start, self.end))
        with self.assertRaises(ValueError):
            weekly_window(datetime(2026, 11, 8, 12))

    def test_report_summarizes_weekly_assignments_scores_and_two_gaps(self):
        report, created = build_weekly_report(self.db, self.student_id, self.now)

        self.assertTrue(created)
        self.assertEqual(report["completed_assignments"], 2)
        self.assertEqual(report["average_success_percent"], 50)
        self.assertEqual(
            [(gap["title"], gap["success_percent"]) for gap in report["critical_gaps"]],
            [("Kesirleri tanıma", 0), ("Kesirleri karşılaştırma", 33.33)],
        )
        self.assertEqual(self.db.notification_jobs.count_documents({}), 1)

        same_report, created_again = build_weekly_report(self.db, self.student_id, self.now)
        self.assertFalse(created_again)
        self.assertEqual(same_report["_id"], report["_id"])
        self.assertEqual(self.db.parent_reports.count_documents({}), 1)
        self.assertEqual(self.db.notification_jobs.count_documents({}), 1)

    def test_report_without_assessment_data_does_not_invent_zero_percent(self):
        self.db.quiz_sonuclari.delete_many({})
        report, _ = build_weekly_report(self.db, self.student_id, self.now)

        self.assertIsNone(report["average_success_percent"])
        self.assertEqual(report["critical_gaps"], [])

    def test_report_endpoint_returns_the_persisted_weekly_summary(self):
        start, end = weekly_window(datetime.now(timezone.utc))
        self.db.odev_atamalari.delete_many({})
        self.db.odev_atamalari.insert_many([
            {"studentUserId": self.student_id, "status": "Teslim edildi",
             "submittedAt": start + timedelta(hours=1)},
            {"studentUserId": self.student_id, "status": "Geç teslim",
             "submittedAt": end - timedelta(hours=1)},
        ])
        self.db.quiz_sonuclari.delete_many({})
        self.db.quiz_sonuclari.insert_one({
            "studentId": self.student_id,
            "createdAt": start + timedelta(hours=1),
            "performance": [
                {"curriculum_node_id": self.weakest, "correct": False},
                {"curriculum_node_id": self.strong, "correct": True},
            ],
        })
        app = FastAPI()
        app.include_router(parent_reports_router)
        app.dependency_overrides[get_collection] = lambda: self.db.curriculum_nodes

        with TestClient(app) as client:
            response = client.get(f"/api/v1/parents/{self.student_id}/report")

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["student_id"], self.student_id)
        self.assertEqual(result["completed_assignments"], 2)
        self.assertEqual(result["average_success_percent"], 50)
        self.assertEqual(len(result["critical_gaps"]), 1)

    def test_weekly_job_deduplicates_students_and_reports(self):
        self.db.parents.insert_one({"studentId": ObjectId(self.student_id)})

        student_count, report_count = generate_all_weekly_reports(self.db, self.now)
        self.assertEqual((student_count, report_count), (1, 1))
        student_count, report_count = generate_all_weekly_reports(self.db, self.now)
        self.assertEqual((student_count, report_count), (1, 0))
        self.assertEqual(self.db.parent_reports.count_documents({}), 1)

    def test_report_generation_uses_the_configured_notification_provider(self):
        class RecordingProvider:
            def __init__(self):
                self.sent = []

            def send(self, parent, job):
                self.sent.append(job["event_type"])

        provider = RecordingProvider()
        build_weekly_report(self.db, self.student_id, self.now, provider)

        self.assertEqual(provider.sent, ["weekly_report"])
        self.assertEqual(
            self.db.notification_jobs.find_one()["status"],
            "sent",
        )


if __name__ == "__main__":
    unittest.main()
