from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.collection import Collection

from .database import get_collection
from .models import Assignment
from .schemas import ObjectIdString

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    teacher_id: str = Field(min_length=1, max_length=128)
    grade: int = Field(ge=1, le=12)
    section: str = Field(min_length=1, max_length=12)
    curriculum_node_ids: list[ObjectIdString] = Field(min_length=1, max_length=20)
    due_date: datetime

    @field_validator("due_date")
    @classmethod
    def future_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("due_date must include a timezone")
        value = value.astimezone(timezone.utc)
        if value <= datetime.now(timezone.utc):
            raise ValueError("due_date must be in the future")
        return value


def valid_question(question: object) -> bool:
    if not isinstance(question, dict):
        return False
    options = question.get("options")
    return (
        isinstance(question.get("text"), str) and bool(question["text"].strip())
        and isinstance(options, dict)
        and all(isinstance(options.get(key), str) and options[key].strip() for key in "ABCD")
        and isinstance(question.get("answer"), str)
        and len(question["answer"]) == 1
        and question["answer"] in "ABCD"
    )


def assignment_transaction(db, payload: AssignmentCreate, session) -> dict:
    node_ids = list(dict.fromkeys(ObjectId(value) for value in payload.curriculum_node_ids))
    nodes = list(db.curriculum_nodes.find(
        {"_id": {"$in": node_ids}, "node_type": {"$in": ["TEMA_UNITE", "KAZANIM_CIKTI"]}, "is_active": True},
        session=session,
    ))
    if len(nodes) != len(node_ids):
        raise HTTPException(status_code=404, detail="Etkin tema veya kazanım bulunamadı.")
    by_id = {node["_id"]: node for node in nodes}
    nodes = [by_id[node_id] for node_id in node_ids]
    included = set(node_ids)
    frontier = [node["_id"] for node in nodes if node["node_type"] == "TEMA_UNITE"]
    while frontier:
        children = list(db.curriculum_nodes.find(
            {"parent_id": {"$in": frontier}, "is_active": True}, {"_id": 1}, session=session
        ))
        frontier = [child["_id"] for child in children if child["_id"] not in included]
        included.update(frontier)
    recipients = list(db.ogrenci_profilleri.find(
        {"teacherId": payload.teacher_id, "grade": payload.grade, "section": payload.section, "active": True},
        session=session,
    ))
    if not recipients:
        raise HTTPException(status_code=400, detail="Bu sınıf ve şubede etkin öğrenci bulunamadı.")
    quiz_filter = {
        "questions.curriculum_node_id": {"$in": list(included)},
        "source": {"$ne": "curriculum_assignment"},
        "$or": [{"source": {"$ne": "ai"}}, {"source": "ai", "published": True}],
    }
    questions = []
    for quiz in db.quizler.find(quiz_filter, {"questions": 1}, session=session).sort("_id", 1):
        for question in quiz.get("questions", []):
            if valid_question(question) and question.get("curriculum_node_id") in included:
                questions.append({key: question[key] for key in ("text", "options", "answer", "html", "svg", "outcomeCode", "curriculum_node_id") if key in question})
                if len(questions) == 10:
                    break
        if len(questions) == 10:
            break
    if not questions:
        raise HTTPException(status_code=400, detail="Seçilen düğümlerde çözülebilir şıklı test sorusu bulunamadı.")
    now = datetime.now(timezone.utc)
    quiz_id, homework_id = ObjectId(), ObjectId()
    title = "Maarif müfredat ödevi"
    db.quizler.insert_one({
        "_id": quiz_id, "title": title, "description": "Seçilen müfredat düğümlerinden hazırlanan test",
        "questions": questions, "createdBy": payload.teacher_id, "createdAt": now,
        "source": "curriculum_assignment",
    }, session=session)
    db.odevler.insert_one({
        "_id": homework_id, "teacherId": payload.teacher_id, "title": title,
        "description": "", "grade": payload.grade, "section": payload.section,
        "topic": ", ".join(item["title"] for item in nodes)[:180],
        "type": "online", "quizId": str(quiz_id), "resourceFile": None, "dueAt": payload.due_date,
        "status": "Yayında", "recipientCount": len(recipients), "createdAt": now, "updatedAt": now,
        "curriculumNodeIds": node_ids,
        "curriculumAssignmentId": homework_id,
    }, session=session)
    db.curriculum_assignments.insert_one(Assignment.model_validate({
        "_id": homework_id, "teacher_id": payload.teacher_id,
        "class_id": {"grade": payload.grade, "section": payload.section},
        "curriculum_node_id": node_ids[0], "curriculum_node_ids": node_ids,
        "content_type": "TEMA" if nodes[0]["node_type"] == "TEMA_UNITE" else "KAZANIM",
        "due_date": payload.due_date, "status": "ACTIVE", "created_at": now,
        "recipient_count": len(recipients), "completed_student_ids": [], "quiz_id": quiz_id,
    }).model_dump(by_alias=True), session=session)
    db.odev_atamalari.insert_many([{
        "teacherId": payload.teacher_id, "homeworkId": homework_id,
        "studentProfileId": profile["_id"], "studentUserId": profile.get("linkedUserId"),
        "status": "Atandı", "dueAt": payload.due_date, "assignedAt": now, "createdAt": now,
        "updatedAt": now, "submittedAt": None, "score": None, "feedback": "",
    } for profile in recipients], session=session)
    db.ogrenci_odev_islem_gecmisi.insert_one({
        "teacherId": payload.teacher_id, "actorId": payload.teacher_id,
        "action": "homework.published", "entity": "homework", "entityId": str(homework_id),
        "details": {"grade": payload.grade, "section": payload.section, "recipientCount": len(recipients)},
        "createdAt": now,
    }, session=session)
    return {"id": str(homework_id), "quiz_id": str(quiz_id), "question_count": len(questions),
            "recipient_count": len(recipients), "unlinked_count": sum(not p.get("linkedUserId") for p in recipients)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_assignment(payload: AssignmentCreate, collection: Annotated[Collection, Depends(get_collection)]):
    db = collection.database
    with db.client.start_session() as session:
        return session.with_transaction(lambda active: assignment_transaction(db, payload, active))
