from enum import Enum

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
