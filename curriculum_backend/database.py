import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

ROOT = Path(__file__).resolve().parent.parent


def load_config() -> None:
    for name in (".env", "baglanti_adresi.env"):
        load_dotenv(ROOT / name, override=False)


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    load_config()
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is required")
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


def get_database() -> Database:
    client = get_client()
    return client[os.environ.get("DB_ADI") or "etut_merkezi"]


def ensure_indexes(collection: Collection) -> None:
    collection.create_index(
        [("parent_id", ASCENDING), ("order_index", ASCENDING), ("_id", ASCENDING)],
        name="curriculum_parent_order",
    )
    collection.database["sorular"].create_index(
        [("curriculum_node_id", ASCENDING)], name="curriculum_node_id"
    )
    collection.database["quizler"].create_index(
        [("questions.curriculum_node_id", ASCENDING)], name="quiz_question_curriculum_node_id"
    )
    collection.database["curriculum_materials"].create_index(
        [("curriculum_node_id", ASCENDING), ("active", ASCENDING)], name="material_curriculum_active"
    )
    collection.database["quiz_sonuclari"].create_index(
        [("studentId", ASCENDING), ("createdAt", -1), ("_id", -1)], name="student_recent_results"
    )
    collection.database["parent_reports"].create_index(
        [("student_id", ASCENDING), ("week_start", ASCENDING)],
        unique=True,
        name="parent_report_student_week",
    )
    collection.database["notification_jobs"].create_index(
        [("event_id", ASCENDING)], unique=True, name="notification_event_id"
    )
    collection.database["notification_jobs"].create_index(
        [("status", ASCENDING), ("created_at", ASCENDING)], name="notification_pending"
    )


def get_collection() -> Collection:
    return get_database()["curriculum_nodes"]
