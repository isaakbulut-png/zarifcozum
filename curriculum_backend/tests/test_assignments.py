import unittest
from datetime import datetime, timedelta, timezone

import mongomock
from bson import ObjectId
from fastapi import HTTPException

from curriculum_backend.assignments import AssignmentCreate, assignment_transaction, valid_question


class AssignmentTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().test
        self.theme, self.outcome = ObjectId(), ObjectId()
        self.db.curriculum_nodes.insert_many([
            {"_id": self.theme, "parent_id": None, "node_type": "TEMA_UNITE", "is_active": True, "title": "Tema"},
            {"_id": self.outcome, "parent_id": self.theme, "node_type": "KAZANIM_CIKTI", "is_active": True, "title": "Kazanım"},
        ])
        self.db.ogrenci_profilleri.insert_many([
            {"teacherId": "teacher", "grade": 9, "section": "A", "active": True, "linkedUserId": "student"},
            {"teacherId": "teacher", "grade": 9, "section": "A", "active": True},
            {"teacherId": "other", "grade": 9, "section": "A", "active": True},
        ])
        self.payload = AssignmentCreate(
            teacher_id="teacher", grade=9, section="A",
            curriculum_node_ids=[str(self.theme), str(self.outcome)],
            due_date=datetime.now(timezone.utc) + timedelta(days=1),
        )

    def test_creates_partial_test_and_only_teacher_recipients(self):
        question = {"text": "Soru", "options": dict.fromkeys("ABCD", "seçenek"), "answer": "A",
                    "curriculum_node_id": self.outcome}
        self.db.quizler.insert_one({"questions": [question], "createdBy": "other"})
        result = assignment_transaction(self.db, self.payload, None)
        self.assertEqual((result["question_count"], result["recipient_count"], result["unlinked_count"]), (1, 2, 1))
        quiz = self.db.quizler.find_one({"_id": ObjectId(result["quiz_id"])})
        self.assertEqual(quiz["source"], "curriculum_assignment")
        self.assertEqual(quiz["questions"][0]["curriculum_node_id"], self.outcome)
        record = self.db.curriculum_assignments.find_one({"_id": ObjectId(result["id"])})
        self.assertEqual((record["status"], record["content_type"]), ("ACTIVE", "TEMA"))
        self.assertEqual(record["curriculum_node_ids"], [self.theme, self.outcome])
        self.assertEqual(self.db.odev_atamalari.count_documents({}), 2)

    def test_caps_at_ten_and_rejects_empty_or_unpublished(self):
        question = {"text": "Soru", "options": dict.fromkeys("ABCD", "x"), "answer": "B",
                    "curriculum_node_id": self.outcome}
        self.db.quizler.insert_one({"source": "ai", "published": False, "questions": [question]})
        with self.assertRaises(HTTPException):
            assignment_transaction(self.db, self.payload, None)
        self.assertEqual(self.db.odevler.count_documents({}), 0)
        self.db.quizler.insert_one({"questions": [question] * 12})
        self.assertEqual(assignment_transaction(self.db, self.payload, None)["question_count"], 10)

    def test_invalid_question_and_class(self):
        self.assertFalse(valid_question({"text": "x", "options": dict.fromkeys("ABCD", "x")}))
        self.payload.section = "B"
        with self.assertRaises(HTTPException):
            assignment_transaction(self.db, self.payload, None)


if __name__ == "__main__":
    unittest.main()
