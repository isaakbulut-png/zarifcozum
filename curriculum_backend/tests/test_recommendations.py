import unittest
from datetime import datetime, timedelta, timezone

import mongomock
from bson import ObjectId

from curriculum_backend.recommendations import build_recommendations, fingerprint


class RecommendationTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().test
        self.student = str(ObjectId())
        self.node, self.other = ObjectId(), ObjectId()
        self.db.curriculum_nodes.insert_many([
            {"_id": self.node, "node_type": "KAZANIM_CIKTI", "is_active": True, "title": "Bir", "code": "MAT.9.1"},
            {"_id": self.other, "node_type": "KAZANIM_CIKTI", "is_active": True, "title": "İki", "code": "MAT.9.2"},
        ])
        self.db.ogrenci_profilleri.insert_one({"linkedUserId": self.student, "active": True, "grade": 9})
        self.questions = [
            {"text": f"Soru {i}", "options": dict.fromkeys("ABCD", "x"), "answer": "A", "curriculum_node_id": self.node}
            for i in range(5)
        ]
        self.db.quizler.insert_one({"grade": 9, "questions": self.questions})
        self.db.quiz_sonuclari.insert_one({
            "studentId": self.student, "createdAt": datetime.now(timezone.utc),
            "performance": [
                {"curriculum_node_id": self.node, "question_fingerprint": fingerprint(self.questions[0]), "correct": True},
                *[{"curriculum_node_id": self.node, "question_fingerprint": fingerprint(self.questions[0]), "correct": False} for _ in range(3)],
                {"curriculum_node_id": self.other, "question_fingerprint": "other", "correct": False},
                {"curriculum_node_id": self.other, "question_fingerprint": "other2", "correct": True},
            ]
        })

    def test_ranking_exact_three_and_no_answers(self):
        self.db.curriculum_materials.insert_one({
            "curriculum_node_id": self.node, "active": True, "type": "VIDEO",
            "title": "Ders", "url": "https://example.org/video"
        })
        result = build_recommendations(self.db, self.student)
        first, second = result["recommendations"]
        self.assertEqual((first["success_percent"], second["success_percent"]), (25, 50))
        self.assertEqual(len(first["questions"]), 3)
        self.assertNotIn("Soru 0", [q["text"] for q in first["questions"]])
        self.assertTrue(all(set(q) == {"text", "options"} for q in first["questions"]))
        self.assertEqual(first["material"]["type"], "VIDEO")
        self.assertEqual(second["missing_question_count"], 3)
        self.assertTrue(second["missing_material"])

    def test_incomplete_history_and_conflicting_grade_fail_closed(self):
        self.db.quiz_sonuclari.insert_one({"studentId": self.student, "createdAt": datetime.now(timezone.utc)})
        result = build_recommendations(self.db, self.student)
        self.assertEqual(result["question_selection_status"], "incomplete_history")
        self.assertEqual(result["recommendations"][0]["questions"], [])
        self.assertEqual(result["incomplete_recent_tests"], 1)
        self.db.quiz_sonuclari.delete_one({"studentId": self.student, "performance": {"$exists": False}})
        self.db.ogrenci_profilleri.insert_one({"linkedUserId": self.student, "active": True, "grade": 8})
        result = build_recommendations(self.db, self.student)
        self.assertEqual(result["question_selection_status"], "missing_or_conflicting_grade")
        self.assertEqual(result["recommendations"][0]["questions"], [])

    def test_checked_questions_in_open_attempt_are_excluded(self):
        self.db.quiz_canli_deneme.insert_one({
            "studentId": self.student, "status": "open",
            "questions": [self.questions[1]], "state": [{"checks": 1}]
        })
        result = build_recommendations(self.db, self.student)
        texts = [q["text"] for q in result["recommendations"][0]["questions"]]
        self.assertNotIn("Soru 1", texts)
        self.assertEqual(len(texts), 3)

    def test_partial_and_invalid_material(self):
        self.db.quizler.delete_many({})
        self.db.quizler.insert_one({"grade": 9, "questions": self.questions[:2]})
        self.db.curriculum_materials.insert_one({
            "curriculum_node_id": self.node, "active": True, "type": "VIDEO",
            "title": "Geçersiz", "url": "javascript:alert(1)"
        })
        first = build_recommendations(self.db, self.student)["recommendations"][0]
        self.assertEqual(len(first["questions"]), 1)
        self.assertEqual(first["missing_question_count"], 2)
        self.assertTrue(first["missing_material"])

    def test_window_and_material_validation(self):
        now = datetime.now(timezone.utc)
        for i in range(21):
            self.db.quiz_sonuclari.insert_one({
                "studentId": self.student, "createdAt": now + timedelta(seconds=i + 1),
                "performance": [{"curriculum_node_id": self.node, "question_fingerprint": "x", "correct": True}]
            })
        self.db.curriculum_materials.insert_one({
            "curriculum_node_id": self.node, "active": True, "type": "VIDEO", "title": "Unsafe", "url": "javascript:alert(1)"
        })
        result = build_recommendations(self.db, self.student)
        self.assertEqual(result["recent_tests"], 20)
        self.assertEqual(result["recommendations"], [])


if __name__ == "__main__":
    unittest.main()
