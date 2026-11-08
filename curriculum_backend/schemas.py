from typing import Annotated

from bson import ObjectId
from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from .models import CurriculumNodeType


def valid_object_id(value: str) -> str:
    if not ObjectId.is_valid(value):
        raise ValueError("Invalid MongoDB ObjectId")
    return str(ObjectId(value))


ObjectIdString = Annotated[str, AfterValidator(valid_object_id)]


class CurriculumNodeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    parent_id: ObjectIdString | None = None
    node_type: CurriculumNodeType
    title: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=100)
    order_index: int = Field(default=0, ge=-2147483648, le=2147483647)
    is_active: bool = True
    metadata: dict = Field(default_factory=dict)


class CurriculumNodeResponse(BaseModel):
    id: ObjectIdString
    parent_id: ObjectIdString | None
    node_type: CurriculumNodeType
    title: str
    code: str
    order_index: int
    is_active: bool
    metadata: dict
    content_count: int | None = None
    children: list["CurriculumNodeResponse"] = Field(default_factory=list)
