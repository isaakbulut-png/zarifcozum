import unittest

import mongomock
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from curriculum_backend.database import get_collection
from curriculum_backend.notifications import create_notification_router


class RecordingProvider:
    def __init__(self):
        self.sent = []

    def send(self, parent, job):
        self.sent.append((parent, job))


class FailingProvider:
    def send(self, parent, job):
        raise RuntimeError("provider unavailable")


class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().test
        self.student_id = str(ObjectId())
        self.parent_id = ObjectId()
        self.db.parents.insert_one({
            "_id": self.parent_id,
            "studentId": ObjectId(self.student_id),
            "restricted": False,
            "phone": "05000000000",
        })
        self.payload = {
            "student_id": self.student_id,
            "event_id": "assignment-completed:assignment-1",
            "event_type": "assignment_completed",
            "title": "Ödev tamamlandı",
            "body": "Öğrenciniz bir ödevi tamamladı.",
        }

    def client(self, provider=None):
        app = FastAPI()
        app.include_router(create_notification_router(provider))
        app.dependency_overrides[get_collection] = lambda: self.db.curriculum_nodes
        return TestClient(app, raise_server_exceptions=False)

    def test_unconfigured_provider_persists_explicit_queued_job(self):
        with self.client() as client:
            response = client.post("/api/v1/notifications/send", json=self.payload)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "queued")
        self.assertIn("configured", response.json()["reason"])
        job = self.db.notification_jobs.find_one({"event_id": self.payload["event_id"]})
        self.assertEqual(job["status"], "queued")
        self.assertEqual(job["parent_id"], self.parent_id)

    def test_configured_provider_sends_once_for_duplicate_event(self):
        provider = RecordingProvider()
        with self.client(provider) as client:
            first = client.post("/api/v1/notifications/send", json=self.payload)
            second = client.post("/api/v1/notifications/send", json=self.payload)

        self.assertEqual(first.status_code, 202)
        self.assertEqual(first.json()["status"], "sent")
        self.assertEqual(second.json()["status"], "sent")
        self.assertEqual(len(provider.sent), 1)
        self.assertEqual(
            self.db.notification_jobs.find_one({"event_id": self.payload["event_id"]})["status"],
            "sent",
        )

    def test_missing_parent_is_skipped_without_creating_a_job(self):
        self.db.parents.delete_many({})
        with self.client() as client:
            response = client.post("/api/v1/notifications/send", json=self.payload)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "skipped")
        self.assertEqual(self.db.notification_jobs.count_documents({}), 0)

    def test_provider_failure_is_reported_and_saved(self):
        with self.client(FailingProvider()) as client:
            response = client.post("/api/v1/notifications/send", json=self.payload)

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            self.db.notification_jobs.find_one({"event_id": self.payload["event_id"]})["status"],
            "failed",
        )

    def test_failed_notification_can_be_retried(self):
        with self.client(FailingProvider()) as client:
            first = client.post("/api/v1/notifications/send", json=self.payload)
        provider = RecordingProvider()
        with self.client(provider) as client:
            retry = client.post("/api/v1/notifications/send", json=self.payload)

        self.assertEqual(first.status_code, 502)
        self.assertEqual(retry.status_code, 202)
        self.assertEqual(retry.json()["status"], "sent")
        self.assertEqual(len(provider.sent), 1)

    def test_invalid_payload_is_rejected(self):
        with self.client() as client:
            response = client.post(
                "/api/v1/notifications/send",
                json={**self.payload, "unexpected": True},
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.notification_jobs.count_documents({}), 0)


if __name__ == "__main__":
    unittest.main()
