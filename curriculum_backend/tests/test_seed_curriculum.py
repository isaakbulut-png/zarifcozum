import unittest

import mongomock

from curriculum_backend.seed_curriculum import SEED_MARKER, SEED_NODES, seed_curriculum


class SeedTests(unittest.TestCase):
    def setUp(self):
        self.collection = mongomock.MongoClient().test.curriculum_nodes

    def test_seed_creates_hierarchy_and_preserves_existing_nodes(self):
        self.assertEqual(seed_curriculum(self.collection), (5, 0))
        for index, seed in enumerate(SEED_NODES):
            doc = self.collection.find_one({"_id": seed.id})
            self.assertEqual(doc["parent_id"], SEED_NODES[index - 1].id if index else None)
            self.assertEqual(doc["metadata"]["seed"], SEED_MARKER)
        doc = self.collection.find_one({"_id": SEED_NODES[-1].id})
        self.assertEqual(doc["metadata"]["beceriler"], ["Eleştirel Düşünme", "Problem Çözme"])
        self.collection.update_one({"_id": SEED_NODES[0].id}, {"$set": {"title": "Edited"}})
        self.assertEqual(seed_curriculum(self.collection), (0, 5))
        self.assertEqual(self.collection.find_one({"_id": SEED_NODES[0].id})["title"], "Edited")

    def test_collision_fails_without_overwriting(self):
        self.collection.insert_one({"_id": SEED_NODES[0].id, "code": "OTHER"})
        with self.assertRaisesRegex(RuntimeError, "changed identity"):
            seed_curriculum(self.collection)
        self.assertEqual(self.collection.count_documents({}), 1)


if __name__ == "__main__":
    unittest.main()
