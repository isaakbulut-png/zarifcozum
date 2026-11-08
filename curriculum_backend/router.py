import logging
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.collection import Collection

from .database import get_collection
from .models import CurriculumNode
from .schemas import CurriculumNodeCreate, CurriculumNodeResponse, ObjectIdString

router = APIRouter(prefix="/api/v1/curriculum", tags=["curriculum"])
CollectionDependency = Annotated[Collection, Depends(get_collection)]
logger = logging.getLogger(__name__)


def node_response(document: dict) -> CurriculumNodeResponse:
    return CurriculumNodeResponse(
        id=str(document["_id"]),
        parent_id=str(document["parent_id"]) if document["parent_id"] is not None else None,
        node_type=document["node_type"], title=document["title"], code=document["code"],
        order_index=document["order_index"], is_active=document["is_active"],
        metadata=document["metadata"], content_count=document.get(
            "content_count", 0 if document["node_type"] in ("TEMA_UNITE", "KAZANIM_CIKTI") else None
        ),
    )


def add_content_counts(collection: Collection, documents: list[dict]) -> None:
    ids = [doc["_id"] for doc in documents if doc["node_type"] in ("TEMA_UNITE", "KAZANIM_CIKTI")]
    counts = {node_id: 0 for node_id in ids}
    if ids:
        question_pipeline = [
            {"$match": {"curriculum_node_id": {"$in": ids}}},
            {"$group": {"_id": "$curriculum_node_id", "count": {"$sum": 1}}},
        ]
        quiz_pipeline = [
            {"$match": {"questions.curriculum_node_id": {"$in": ids}, "source": {"$ne": "curriculum_assignment"}}},
            {"$unwind": "$questions"},
            {"$match": {"questions.curriculum_node_id": {"$in": ids}}},
            {"$group": {"_id": "$questions.curriculum_node_id", "count": {"$sum": 1}}},
        ]
        for result in collection.database["sorular"].aggregate(question_pipeline):
            counts[result["_id"]] += result["count"]
        for result in collection.database["quizler"].aggregate(quiz_pipeline):
            counts[result["_id"]] += result["count"]
    for doc in documents:
        if doc["_id"] in counts:
            doc["content_count"] = counts[doc["_id"]]


def build_tree(documents: list[dict], parent_id: ObjectId | None) -> list[CurriculumNodeResponse]:
    responses = {doc["_id"]: node_response(doc) for doc in documents}
    roots = []
    for doc in sorted(documents, key=lambda item: (item["order_index"], item["_id"])):
        response = responses[doc["_id"]]
        if doc["_id"] == parent_id or doc["parent_id"] is None:
            roots.append(response)
        else:
            responses[doc["parent_id"]].children.append(response)
    for doc in documents:
        if doc["node_type"] != "KAZANIM_CIKTI":
            continue
        ancestor = doc["parent_id"]
        while ancestor in responses:
            parent = responses[ancestor]
            if parent.node_type == "TEMA_UNITE":
                parent.content_count = (parent.content_count or 0) + responses[doc["_id"]].content_count
            ancestor = ObjectId(parent.parent_id) if parent.parent_id is not None else None
    return roots


@router.get("/tree", response_model=list[CurriculumNodeResponse])
def get_tree(collection: CollectionDependency, parent_id: Annotated[ObjectIdString | None, Query()] = None):
    if parent_id is None:
        documents = list(collection.find({}))
        by_parent: dict[ObjectId | None, list[dict]] = {}
        for doc in documents:
            by_parent.setdefault(doc["parent_id"], []).append(doc)
        reachable = []
        pending = list(by_parent.get(None, []))
        while pending:
            doc = pending.pop()
            reachable.append(doc)
            pending.extend(by_parent.get(doc["_id"], []))
        if len(reachable) != len(documents):
            logger.error("Curriculum contains %d unreachable nodes", len(documents) - len(reachable))
            raise HTTPException(status_code=500, detail="Invalid or disconnected curriculum tree")
        add_content_counts(collection, reachable)
        return build_tree(reachable, None)

    root_id = ObjectId(parent_id)
    root = collection.find_one({"_id": root_id})
    if root is None:
        raise HTTPException(status_code=404, detail="Curriculum node not found")
    documents = [root]
    frontier = [root_id]
    visited = {root_id}
    while frontier:
        children = list(collection.find({"parent_id": {"$in": frontier}}))
        frontier = []
        for child in children:
            if child["_id"] in visited:
                logger.error("Curriculum cycle detected at node %s", child["_id"])
                raise HTTPException(status_code=500, detail="Cycle detected in curriculum tree")
            visited.add(child["_id"])
            documents.append(child)
            frontier.append(child["_id"])
    add_content_counts(collection, documents)
    return build_tree(documents, root_id)


@router.post("/nodes", response_model=CurriculumNodeResponse, status_code=status.HTTP_201_CREATED)
def create_node(payload: CurriculumNodeCreate, collection: CollectionDependency):
    parent_id = ObjectId(payload.parent_id) if payload.parent_id is not None else None
    if parent_id is not None and collection.find_one({"_id": parent_id}, {"_id": 1}) is None:
        raise HTTPException(status_code=404, detail="Parent curriculum node not found")
    node = CurriculumNode(**payload.model_dump(exclude={"parent_id"}), parent_id=parent_id)
    document = node.document()
    collection.insert_one(document)
    return node_response(document)
