import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from ..cameras.base import CameraBase
from ..printer.hp_tij import HPTIJPrinter, PrinterError
from ..rejection.delay_queue import RejectDelayQueue
from ..utils.logger import get_logger
from .defect_detector import InspectorBase

logger = get_logger(__name__)


class InspectionPipeline:
    """Wires camera -> inspector -> (print good | schedule reject) into a
    continuous line-inspection loop, with basic stats and reject-image
    archiving for GMP traceability."""

    def __init__(
        self,
        camera: CameraBase,
        inspector: InspectorBase,
        reject_queue: RejectDelayQueue,
        reject_delay_ms: float,
        printer: Optional[HPTIJPrinter] = None,
        print_fields: Optional[Dict[str, Any]] = None,
        save_reject_images: bool = True,
        reject_image_dir: str = "./rejects",
        target_fps: float = 30,
    ):
        self._camera = camera
        self._inspector = inspector
        self._reject_queue = reject_queue
        self._reject_delay_ms = reject_delay_ms
        self._printer = printer
        self._print_fields = print_fields or {}
        self._save_reject_images = save_reject_images
        self._reject_image_dir = Path(reject_image_dir)
        self._frame_interval_s = 1.0 / target_fps if target_fps > 0 else 0

        self._running = False
        self._thread: Optional[threading.Thread] = None

        self.total_inspected = 0
        self.total_passed = 0
        self.total_rejected = 0

        if self._save_reject_images:
            self._reject_image_dir.mkdir(parents=True, exist_ok=True)

    def start(self) -> None:
        if self._running:
            return
        self._camera.connect()
        if self._printer is not None:
            self._printer.connect()
        self._reject_queue.start()
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("Inspection pipeline started")

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
        self._reject_queue.stop()
        self._camera.disconnect()
        if self._printer is not None:
            self._printer.disconnect()
        logger.info("Inspection pipeline stopped")

    def trigger_test_reject(self) -> None:
        """Manually fire the reject actuator immediately, e.g. for commissioning/HMI testing."""
        self._reject_queue.schedule(delay_ms=0, product_id="manual-test", reason="manual_test_trigger")

    def stats(self) -> Dict[str, Any]:
        return {
            "total_inspected": self.total_inspected,
            "total_passed": self.total_passed,
            "total_rejected": self.total_rejected,
            "pending_reject_queue": self._reject_queue.pending_count(),
            "camera_connected": self._camera.is_connected,
            "printer_connected": self._printer.is_connected if self._printer else None,
        }

    def _run(self) -> None:
        while self._running:
            loop_start = time.monotonic()
            try:
                frame = self._camera.read_frame()
            except Exception:
                logger.exception("Camera read failed")
                time.sleep(0.5)
                continue

            if frame is not None:
                self._process_frame(frame)

            if self._frame_interval_s:
                elapsed = time.monotonic() - loop_start
                sleep_time = self._frame_interval_s - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)

    def _process_frame(self, frame) -> None:
        result = self._inspector.inspect(frame)
        self.total_inspected += 1

        if result.passed:
            self.total_passed += 1
            self._print_good_unit(result.product_id)
        else:
            self.total_rejected += 1
            self._reject_queue.schedule(
                delay_ms=self._reject_delay_ms,
                product_id=result.product_id,
                reason=",".join(result.defects) or "inspection_failed",
            )
            if self._save_reject_images:
                self._save_reject_image(frame, result.product_id)

        logger.debug(
            "Inspected %s: passed=%s confidence=%.2f defects=%s",
            result.product_id,
            result.passed,
            result.confidence,
            result.defects,
        )

    def _print_good_unit(self, product_id: str) -> None:
        if self._printer is None:
            return
        fields = {**self._print_fields, "product_id": product_id}
        try:
            self._printer.send_print_job(fields)
        except PrinterError:
            logger.exception("Failed to print job for unit %s", product_id)

    def _save_reject_image(self, frame, product_id: str) -> None:
        import cv2

        out_path = self._reject_image_dir / f"{int(time.time() * 1000)}_{product_id}.jpg"
        cv2.imwrite(str(out_path), frame)
