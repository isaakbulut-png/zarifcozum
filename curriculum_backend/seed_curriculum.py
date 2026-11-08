"""Load a small illustrative curriculum tree; this is not official MEB data."""

from dataclasses import dataclass
from hashlib import sha256
from uuid import UUID, uuid5

from bson import ObjectId
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from .database import ensure_indexes, get_client, get_collection
from .models import CurriculumNode, CurriculumNodeType

SEED_NAMESPACE = UUID("f88a3a50-bd60-4e3f-8b2f-14051584ee04")
SEED_MARKER = "maarif_ornek_matematik_9_v1"


@dataclass(frozen=True)
class SeedNode:
    key: str
    parent_key: str | None
    node_type: CurriculumNodeType
    title: str
    code: str
    metadata: dict

    @property
    def id(self) -> ObjectId:
        return ObjectId(sha256(uuid5(SEED_NAMESPACE, self.key).bytes).digest()[:12])

    @property
    def parent_id(self) -> ObjectId | None:
        if self.parent_key is None:
            return None
        return ObjectId(sha256(uuid5(SEED_NAMESPACE, self.parent_key).bytes).digest()[:12])


SEED_NODES = (
    SeedNode("kademe", None, CurriculumNodeType.KADEME, "Ortaöğretim (Lise)",
             "ORNEK.ORTAOGRETIM", {}),
    SeedNode("sinif", "kademe", CurriculumNodeType.SINIF, "9. Sınıf",
             "ORNEK.ORTAOGRETIM.9", {}),
    SeedNode("tema", "sinif", CurriculumNodeType.TEMA_UNITE, "Sayılar ve Nicelikler",
             "ORNEK.MAT.9.SAYILAR_NICELIKLER", {"brans": "Matematik"}),
    SeedNode("kazanim", "tema", CurriculumNodeType.KAZANIM_CIKTI,
             "Gerçek sayılarla ilgili problemlerde uygun gösterimleri kullanır.",
             "MAT.9.1.", {"aciklama": "Temsili öğrenme çıktısı; resmî kazanım metni değildir."}),
    SeedNode("alt_beceri", "kazanim", CurriculumNodeType.ALT_BECERI,
             "Eleştirel Düşünme / Problem Çözme", "ORNEK.MAT.9.1.BECERI",
             {"beceriler": ["Eleştirel Düşünme", "Problem Çözme"]}),
)


def seed_curriculum(collection: Collection) -> tuple[int, int]:
    """Insert missing nodes without changing existing records."""
    created = 0
    for seed in SEED_NODES:
        metadata = {"seed": SEED_MARKER, "ornek_veri": True, **seed.metadata}
        document = CurriculumNode(
            id=seed.id, parent_id=seed.parent_id, node_type=seed.node_type,
            title=seed.title, code=seed.code, order_index=0, is_active=True, metadata=metadata,
        ).document()
        identity = {
            "_id": seed.id, "parent_id": seed.parent_id,
            "node_type": seed.node_type.value, "code": seed.code, "metadata.seed": SEED_MARKER,
        }
        try:
            result = collection.update_one(identity, {"$setOnInsert": document}, upsert=True)
        except DuplicateKeyError as error:
            raise RuntimeError(f"Seed ID collision or changed identity for {seed.key}: {seed.id}") from error
        if result.upserted_id is not None:
            created += 1
    return created, len(SEED_NODES) - created


def main() -> None:
    try:
        collection = get_collection()
        ensure_indexes(collection)
        created, existing = seed_curriculum(collection)
        print(f"Seed tamamlandı: {created} düğüm eklendi, {existing} mevcut düğüm korundu.")
    finally:
        if get_client.cache_info().currsize:
            get_client().close()
            get_client.cache_clear()


if __name__ == "__main__":
    main()
