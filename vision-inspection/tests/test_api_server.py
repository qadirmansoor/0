from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi.testclient import TestClient

from src.api.server import create_api


class FakePipeline:
    """Minimal stand-in exposing the surface create_api() depends on,
    so the API/dashboard wiring can be tested without a real camera."""

    def __init__(self, reject_image_dir: Path):
        self.reject_image_dir = reject_image_dir
        self.started = False
        self.stopped = False
        self.test_rejected = False

    def stats(self) -> Dict[str, Any]:
        return {
            "line_name": "Line-01",
            "running": self.started and not self.stopped,
            "total_inspected": 10,
            "total_passed": 8,
            "total_rejected": 2,
            "pending_reject_queue": 0,
            "camera_connected": True,
            "printer_connected": True,
            "last_result_passed": True,
            "last_defects": [],
        }

    def get_latest_jpeg(self) -> Optional[bytes]:
        return None

    def list_recent_rejects(self, limit: int = 20) -> List[Dict[str, Any]]:
        return [{"filename": "123_abc.jpg", "product_id": "abc", "timestamp_ms": 123}]

    def trigger_test_reject(self) -> None:
        self.test_rejected = True

    def start(self) -> None:
        self.started = True

    def stop(self) -> None:
        self.stopped = True


def make_client(tmp_path: Path) -> TestClient:
    pipeline = FakePipeline(tmp_path / "rejects")
    app = create_api(pipeline)
    return TestClient(app), pipeline


def test_health(tmp_path):
    client, _ = make_client(tmp_path)
    assert client.get("/health").json() == {"status": "ok"}


def test_status_reports_pipeline_stats(tmp_path):
    client, _ = make_client(tmp_path)
    body = client.get("/status").json()
    assert body["total_inspected"] == 10
    assert body["total_passed"] == 8


def test_start_stop_and_test_reject(tmp_path):
    client, pipeline = make_client(tmp_path)
    assert client.post("/start").json() == {"running": True}
    assert pipeline.started is True

    assert client.post("/reject/test").json() == {"scheduled": True}
    assert pipeline.test_rejected is True

    assert client.post("/stop").json() == {"running": False}
    assert pipeline.stopped is True


def test_recent_rejects_includes_image_url(tmp_path):
    client, _ = make_client(tmp_path)
    body = client.get("/rejects/recent").json()
    assert body["rejects"][0]["image_url"] == "/rejects/images/123_abc.jpg"


def test_dashboard_index_served_at_root(tmp_path):
    client, _ = make_client(tmp_path)
    res = client.get("/")
    assert res.status_code == 200
    assert "Vision Inspection" in res.text or "<html" in res.text.lower()
