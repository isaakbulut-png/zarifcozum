import os
import unittest
from unittest.mock import patch

import mongomock
from bson import ObjectId
from fastapi.testclient import TestClient

from curriculum_backend.database import get_collection
from curriculum_backend.main import app
from curriculum_backend.router import build_tree


def node(parent_id=None, order_index=0):
    return {
        "_id": ObjectId(), "parent_id": parent_id, "node_type": "KADEME",
        "title": "Lise", "code": "L", "order_index": order_index,
        "is_active": True, "metadata": {"degerler": ["saygi"]},
    }


class CurriculumTests(unittest.TestCase):
    def setUp(self):
        self.collection = mongomock.MongoClient().test.curriculum_nodes
        app.dependency_overrides[get_collection] = lambda: self.collection
        self.env = patch.dict(os.environ, {"CURRICULUM_SERVICE_TOKEN": "a" * 32})
        self.env.start()
        self.client = TestClient(app)
        self.headers = {"Authorization": f"Bearer {'a' * 32}"}

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.env.stop()

    def test_authentication_and_configuration(self):
        self.assertEqual(self.client.get("/api/v1/curriculum/tree").status_code, 401)
        with patch.dict(os.environ, {"CURRICULUM_SERVICE_TOKEN": ""}):
            self.assertEqual(self.client.get("/api/v1/curriculum/tree").status_code, 503)

    def test_tree_and_subtree(self):
        root = node(order_index=10)
        first = node(root["_id"], 0)
        second = node(root["_id"], 1)
        leaf = node(first["_id"])
        self.collection.insert_many([leaf, second, first, root])
        tree = self.client.get("/api/v1/curriculum/tree", headers=self.headers).json()
        self.assertEqual([x["id"] for x in tree[0]["children"]], [str(first["_id"]), str(second["_id"])])
        self.assertEqual(tree[0]["children"][0]["children"][0]["id"], str(leaf["_id"]))
        response = self.client.get(f"/api/v1/curriculum/tree?parent_id={first['_id']}", headers=self.headers)
        self.assertEqual(response.json()[0]["id"], str(first["_id"]))
        self.assertEqual(response.json()[0]["children"][0]["id"], str(leaf["_id"]))
        self.assertEqual(self.client.get(f"/api/v1/curriculum/tree?parent_id={ObjectId()}", headers=self.headers).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/curriculum/tree?parent_id=bad", headers=self.headers).status_code, 422)

    def test_create_and_validate(self):
        parent = node()
        self.collection.insert_one(parent)
        body = {"parent_id": str(parent["_id"]), "node_type": "SINIF", "title": "10", "code": "MAT.10", "metadata": {"a": [1]}}
        response = self.client.post("/api/v1/curriculum/nodes", headers=self.headers, json=body)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["metadata"], {"a": [1]})
        self.assertEqual(response.json()["children"], [])
        self.assertEqual(self.collection.find_one({"_id": ObjectId(response.json()["id"])})["parent_id"], parent["_id"])
        body["parent_id"] = str(ObjectId())
        self.assertEqual(self.client.post("/api/v1/curriculum/nodes", headers=self.headers, json=body).status_code, 404)
        body["node_type"] = "INVALID"
        self.assertEqual(self.client.post("/api/v1/curriculum/nodes", headers=self.headers, json=body).status_code, 422)

    def test_counts_both_sources_and_theme_direct_and_descendant(self):
        theme = node()
        theme["node_type"] = "TEMA_UNITE"
        outcome = node(theme["_id"])
        outcome["node_type"] = "KAZANIM_CIKTI"
        other = node(theme["_id"])
        other["node_type"] = "KAZANIM_CIKTI"
        self.collection.insert_many([theme, outcome, other])
        questions = self.collection.database["sorular"]
        questions.insert_many([
            {"curriculum_node_id": theme["_id"]},
            {"curriculum_node_id": outcome["_id"]},
            {"curriculum_node_id": outcome["_id"]},
            {"unlinked": True},
        ])
        self.collection.database["quizler"].insert_many([
            {"questions": [{"curriculum_node_id": outcome["_id"]}, {"curriculum_node_id": theme["_id"]}, {}]},
            {"questions": [{"curriculum_node_id": outcome["_id"]}]},
        ])
        result = self.client.get(f"/api/v1/curriculum/tree?parent_id={theme['_id']}", headers=self.headers)
        self.assertEqual(result.status_code, 200, result.text)
        tree = result.json()[0]
        self.assertEqual(tree["content_count"], 6)
        by_id = {child["id"]: child for child in tree["children"]}
        self.assertEqual(by_id[str(outcome["_id"])]["content_count"], 4)
        self.assertEqual(by_id[str(other["_id"])]["content_count"], 0)
        single = self.client.get(f"/api/v1/curriculum/tree?parent_id={outcome['_id']}", headers=self.headers)
        self.assertEqual(single.json()[0]["content_count"], 4)

    def test_count_aggregation_error_is_not_reported_as_zero(self):
        theme = node()
        theme["node_type"] = "TEMA_UNITE"
        self.collection.insert_one(theme)
        with patch.object(type(self.collection.database["sorular"]), "aggregate", side_effect=RuntimeError("database unavailable")):
            with self.assertRaisesRegex(RuntimeError, "database unavailable"):
                self.client.get(f"/api/v1/curriculum/tree?parent_id={theme['_id']}", headers=self.headers)

    def test_tree_assembly_handles_children_before_parent(self):
        root = node(order_index=10)
        child = node(root["_id"])
        self.assertEqual(build_tree([child, root], None)[0].children[0].id, str(child["_id"]))

    def test_cycle_is_reported_for_subtree(self):
        first = node()
        second = node(first["_id"])
        first["parent_id"] = second["_id"]
        self.collection.insert_many([first, second])
        response = self.client.get(f"/api/v1/curriculum/tree?parent_id={first['_id']}", headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.client.get("/api/v1/curriculum/tree", headers=self.headers).status_code, 500)

    def test_orphan_is_reported(self):
        self.collection.insert_one(node(ObjectId()))
        self.assertEqual(self.client.get("/api/v1/curriculum/tree", headers=self.headers).status_code, 500)


if __name__ == "__main__":
    unittest.main()
