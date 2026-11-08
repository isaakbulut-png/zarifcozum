from enum import Enum
from datetime import datetime
from typing import Literal

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class CurriculumNodeType(str, Enum):
    KADEME = "KADEME"
    SINIF = "SINIF"
    TEMA_UNITE = "TEMA_UNITE"
    KAZANIM_CIKTI = "KAZANIM_CIKTI"
    ALT_BECERI = "ALT_BECERI"


class CurriculumNode(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)

    id: ObjectId = Field(default_factory=ObjectId, alias="_id")
    parent_id: ObjectId | None = None
    node_type: CurriculumNodeType
    title: str
    code: str
    order_index: int = 0
    is_active: bool = True
    metadata: dict = Field(default_factory=dict)

    def document(self) -> dict:
        return self.model_dump(by_alias=True, mode="python") | {"node_type": self.node_type.value}


class Assignment(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)

    id: ObjectId = Field(alias="_id")
    teacher_id: str
    class_id: dict
    curriculum_node_id: ObjectId
    curriculum_node_ids: list[ObjectId]
    content_type: Literal["TEMA", "KAZANIM"]
    due_date: datetime
    status: Literal["ACTIVE", "COMPLETED"]
    created_at: datetime
    recipient_count: int
    completed_student_ids: list[ObjectId]
    quiz_id: ObjectId


class ParentReport(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)

    id: ObjectId = Field(default_factory=ObjectId, alias="_id")
    student_id: str
    week_start: datetime
    week_end: datetime
    completed_assignments: int = 0
    average_success_percent: float | None = None
    critical_gaps: list[dict] = Field(default_factory=list)
    generated_at: datetime

    def document(self) -> dict:
        return self.model_dump(by_alias=True, mode="python")
