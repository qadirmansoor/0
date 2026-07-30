import time

import numpy as np

from src.cameras.base import CameraBase, CameraError
from src.inspection.defect_detector import InspectorBase
from src.inspection.models import InspectionResult
from src.inspection.pipeline import InspectionPipeline
from src.rejection.delay_queue import RejectDelayQueue


class FailingCamera(CameraBase):
    """Simulates hardware that isn't reachable at boot (unplugged/misconfigured)."""

    def __init__(self):
        super().__init__(name="failing")

    def connect(self):
        raise CameraError("camera not reachable")

    def disconnect(self):
        self._connected = False

    def read_frame(self):
        return None


class AlwaysPassInspector(InspectorBase):
    def inspect(self, frame) -> InspectionResult:
        return InspectionResult(passed=True, confidence=1.0)


class FakeController:
    def __init__(self):
        self.triggers = []

    def trigger_reject(self, pulse_ms):
        self.triggers.append(pulse_ms)


def test_reject_queue_starts_even_when_camera_fails_to_connect(tmp_path):
    """Regression test: the reject-delay queue (and manual "Test Reject")
    must not depend on the camera successfully connecting -- an operator
    commissioning the reject actuator, or a scheduled reject already in
    flight, shouldn't be silently stuck just because the camera isn't
    plugged in yet."""
    controller = FakeController()
    reject_queue = RejectDelayQueue(controller, pulse_ms=50, poll_interval_s=0.005)

    pipeline = InspectionPipeline(
        camera=FailingCamera(),
        inspector=AlwaysPassInspector(),
        reject_queue=reject_queue,
        reject_delay_ms=10,
        save_reject_images=False,
        reject_image_dir=str(tmp_path),
    )

    try:
        raised = False
        try:
            pipeline.start()
        except CameraError:
            raised = True
        assert raised, "expected CameraError to propagate from a failed camera connect"
        assert pipeline.stats()["running"] is False

        pipeline.trigger_test_reject()
        deadline = time.monotonic() + 1
        while not controller.triggers and time.monotonic() < deadline:
            time.sleep(0.01)
        assert controller.triggers, "reject queue never fired -- it must run independently of camera connect"
    finally:
        pipeline.stop()
