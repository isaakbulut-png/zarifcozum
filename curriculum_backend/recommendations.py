import hashlib
import json
from collections import defaultdict
from typing import Annotated
from urllib.parse import urlsplit

from bson import ObjectId
from fastapi import APIRouter, Depends
from pymongo.collection import Collection

from .assignments import valid_question
from .database import get_collection
from .schemas import ObjectIdString

router = APIRouter(prefix="/api/v1/students", tags=["recommendations"])
THRESHOLD = 60
RECENT_LIMIT = 20


def fingerprint(question: dict) -> str:
    parts = [question["text"], *(question["options"][key] for key in "ABCD"), question["answer"]]
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def safe_material(document: dict) -> dict | None:
    url = document.get("url")
    title = document.get("title")
    if (not isinstance(url, str) or any(ord(char) < 33 or ord(char) == 127 for char in url)
            or not isinstance(title, str) or not title.strip()):
        return None
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            return None
        _ = parsed.port
    except ValueError:
        return None
    return {"title": title, "url": url, "type": document["type"]}


def build_recommendations(db, student_id: str) -> dict:
    # All results are needed for solved-question exclusion; only the latest 20
    # participate in the success calculation.
    recent = list(db.quiz_sonuclari.find(
        {"studentId": student_id}, {"performance": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).limit(RECENT_LIMIT))
    totals = defaultdict(lambda: [0, 0])
    incomplete_recent = 0
    for result in recent:
        performance = result.get("performance")
        if not isinstance(performance, list):
            incomplete_recent += 1
            continue
        if any(not isinstance(item, dict) or not isinstance(item.get("curriculum_node_id"), ObjectId)
               or not isinstance(item.get("question_fingerprint"), str)
               or not isinstance(item.get("correct"), bool) for item in performance):
            incomplete_recent += 1
        for item in performance:
            if (isinstance(item, dict) and isinstance(item.get("curriculum_node_id"), ObjectId)
                    and isinstance(item.get("correct"), bool)):
                totals[item["curriculum_node_id"]][0] += item["correct"]
                totals[item["curriculum_node_id"]][1] += 1

    solved = set()
    incomplete_history = 0
    for result in db.quiz_sonuclari.find({"studentId": student_id}, {"performance": 1}):
        performance = result.get("performance")
        if not isinstance(performance, list) or any(
            not isinstance(item, dict) or not isinstance(item.get("question_fingerprint"), str)
            for item in performance
        ):
            incomplete_history += 1
        if isinstance(performance, list):
            solved.update(item["question_fingerprint"] for item in performance
                          if isinstance(item, dict) and isinstance(item.get("question_fingerprint"), str))

    incomplete_open_attempts = 0
    for attempt in db.quiz_canli_deneme.find({"studentId": student_id, "status": "open"}):
        questions, states = attempt.get("questions"), attempt.get("state")
        if not isinstance(questions, list) or not isinstance(states, list) or len(questions) != len(states):
            incomplete_open_attempts += 1
            continue
        for question, state in zip(questions, states):
            if not isinstance(state, dict) or not isinstance(state.get("checks"), int):
                incomplete_open_attempts += 1
            elif state["checks"] > 0:
                if valid_question(question):
                    solved.add(fingerprint(question))
                else:
                    incomplete_open_attempts += 1

    grades = {profile["grade"] for profile in db.ogrenci_profilleri.find(
        {"linkedUserId": student_id, "active": True}, {"grade": 1}
    ) if isinstance(profile.get("grade"), int) and not isinstance(profile.get("grade"), bool)
        and 1 <= profile["grade"] <= 12}
    grade = next(iter(grades)) if len(grades) == 1 else None
    ids = [node_id for node_id, (correct, total) in totals.items() if correct * 100 < THRESHOLD * total]
    nodes = list(db.curriculum_nodes.find({
        "_id": {"$in": ids}, "node_type": "KAZANIM_CIKTI", "is_active": True
    }))
    nodes.sort(key=lambda node: (totals[node["_id"]][0] / totals[node["_id"]][1], str(node["_id"])))
    recommendations = []
    for node in nodes:
        node_id = node["_id"]
        correct, total = totals[node_id]
        material = None
        for candidate in db.curriculum_materials.find({
            "curriculum_node_id": node_id, "active": True, "type": {"$in": ["LESSON", "VIDEO"]}
        }).sort("_id", 1):
            material = safe_material(candidate)
            if material:
                break
        questions, selected = [], set()
        if grade is not None and not incomplete_history and not incomplete_open_attempts:
            for quiz in db.quizler.find({
                "grade": grade, "questions.curriculum_node_id": node_id,
                "source": {"$ne": "curriculum_assignment"},
                "$or": [{"source": {"$ne": "ai"}}, {"source": "ai", "published": True}]
            }).sort("_id", 1):
                for question in quiz.get("questions", []):
                    if not valid_question(question) or question.get("curriculum_node_id") != node_id:
                        continue
                    key = fingerprint(question)
                    if key in solved or key in selected:
                        continue
                    selected.add(key)
                    questions.append({"text": question["text"], "options": {
                        key: question["options"][key] for key in "ABCD"
                    }})
                    if len(questions) == 3:
                        break
                if len(questions) == 3:
                    break
        recommendations.append({
            "curriculum_node_id": str(node_id), "title": node["title"], "code": node["code"],
            "correct_count": correct, "question_count": total,
            "success_percent": round(correct * 100 / total, 2), "learning_gap": True,
            "material": material, "questions": questions,
            "missing_material": material is None, "missing_question_count": 3 - len(questions),
        })
    return {
        "student_id": student_id, "threshold_percent": THRESHOLD, "recent_test_limit": RECENT_LIMIT,
        "recent_tests": len(recent), "incomplete_recent_tests": incomplete_recent,
        "incomplete_history_tests": incomplete_history, "grade": grade,
        "incomplete_open_attempts": incomplete_open_attempts,
        "grade_status": "available" if grade is not None else "missing_or_conflicting",
        "question_selection_status": (
            "incomplete_history" if incomplete_history else
            "incomplete_open_attempts" if incomplete_open_attempts else
            "missing_or_conflicting_grade" if grade is None else "available"
        ),
        "recommendations": recommendations,
    }


@router.get("/{student_id}/recommendations")
def get_recommendations(student_id: ObjectIdString, collection: Annotated[Collection, Depends(get_collection)]):
    return build_recommendations(collection.database, student_id)
