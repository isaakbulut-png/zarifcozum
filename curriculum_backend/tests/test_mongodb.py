import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from pymongo import MongoClient

from curriculum_backend.database import ensure_indexes, get_collection
from curriculum_backend.main import app
from curriculum_backend.seed_curriculum import SEED_NODES, seed_curriculum


@unittest.skipUnless(os.environ.get("CURRICULUM_TEST_MONGODB_URI"), "MongoDB test URI not configured")
class MongoDBIntegrationTests(unittest.TestCase):
    def test_seed_and_api(self):
        client = MongoClient(os.environ["CURRICULUM_TEST_MONGODB_URI"], serverSelectionTimeoutMS=5000)
        self.addCleanup(client.close)
        database = client["curriculum_test_" + uuid4().hex]
        collection = database["curriculum_nodes"]
        for name in ("curriculum_nodes", "sorular", "quizler"):
            self.addCleanup(database[name].drop)
        ensure_indexes(collection)
        self.assertEqual(seed_curriculum(collection), (5, 0))
        self.assertEqual(seed_curriculum(collection), (0, 5))
        theme_id, outcome_id = SEED_NODES[2].id, SEED_NODES[3].id
        database.sorular.insert_many([{"curriculum_node_id": outcome_id}, {"curriculum_node_id": theme_id}, {}])
        database.quizler.insert_one({"questions": [{"curriculum_node_id": outcome_id}, {}]})
        for seed in SEED_NODES:
            self.assertEqual(collection.find_one({"_id": seed.id})["parent_id"], seed.parent_id)
        app.dependency_overrides[get_collection] = lambda: collection
        self.addCleanup(app.dependency_overrides.clear)
        with patch.dict(os.environ, {"CURRICULUM_SERVICE_TOKEN": "a" * 32}):
            client_api = TestClient(app)
            self.addCleanup(client_api.close)
            headers = {"Authorization": f"Bearer {'a' * 32}"}
            response = client_api.get("/api/v1/curriculum/tree", headers=headers)
            self.assertEqual(response.status_code, 200)
            item = response.json()[0]
            self.assertEqual(item["children"][0]["children"][0]["content_count"], 3)
            self.assertEqual(item["children"][0]["children"][0]["children"][0]["content_count"], 2)
            for seed in SEED_NODES:
                self.assertEqual(item["id"], str(seed.id))
                if item["children"]:
                    item = item["children"][0]
            self.assertEqual(item["metadata"]["beceriler"], ["Eleştirel Düşünme", "Problem Çözme"])
            body = {"parent_id": str(SEED_NODES[0].id), "node_type": "SINIF", "title": "11", "code": "ORNEK.11"}
            created = client_api.post("/api/v1/curriculum/nodes", headers=headers, json=body)
            self.assertEqual(created.status_code, 201, created.text)
            subtree = client_api.get("/api/v1/curriculum/tree", headers=headers, params={"parent_id": created.json()["id"]})
            self.assertEqual(subtree.json()[0]["id"], created.json()["id"])
