import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .base import RejectionControllerBase
from ..utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RejectItem:
    scheduled_time: float  # time.monotonic() deadline
    product_id: str
    reason: str


def compute_delay_ms(delay_config: Dict[str, Any]) -> float:
    """Time from a unit passing the camera to it reaching the reject
    actuator on the conveyor, in milliseconds.

    mode "fixed_ms": a constant, operator-set delay.
    mode "conveyor_speed": derived from the physical camera-to-reject
    distance and the conveyor's line speed, so the delay tracks speed
    changes automatically:  delay_ms = distance_mm / speed_mm_s * 1000.
    """
    mode = delay_config.get("mode", "fixed_ms")
    if mode == "fixed_ms":
        return float(delay_config.get("fixed_ms", 500))
    if mode == "conveyor_speed":
        distance_mm = float(delay_config["camera_to_reject_mm"])
        speed_mm_s = float(delay_config["conveyor_speed_mm_s"])
        if speed_mm_s <= 0:
            raise ValueError("conveyor_speed_mm_s must be > 0")
        return distance_mm / speed_mm_s * 1000
    raise ValueError(f"Unknown delay mode: {mode!r} (expected fixed_ms or conveyor_speed)")


class RejectDelayQueue:
    """FIFO delay line for reject decisions.

    A camera inspects a unit at one point on the conveyor, but the reject
    actuator sits physically downstream. `schedule()` enqueues a reject
    decision with the delay it needs before firing; a background worker
    thread fires each item's `trigger_reject` once its deadline elapses.
    Because units travel the conveyor in order, a plain FIFO queue
    preserves correct firing order as long as delay_ms is computed
    consistently (or per-item, e.g. from live encoder data).
    """

    def __init__(self, controller: RejectionControllerBase, pulse_ms: int, poll_interval_s: float = 0.005):
        self._controller = controller
        self._pulse_ms = pulse_ms
        self._poll_interval_s = poll_interval_s
        self._queue: deque[RejectItem] = deque()
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self.rejected_count = 0

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

    def schedule(self, delay_ms: float, product_id: str, reason: str) -> None:
        item = RejectItem(
            scheduled_time=time.monotonic() + delay_ms / 1000,
            product_id=product_id,
            reason=reason,
        )
        with self._lock:
            self._queue.append(item)
        logger.info("Scheduled reject for %s in %.0fms (reason: %s)", product_id, delay_ms, reason)

    def pending_count(self) -> int:
        with self._lock:
            return len(self._queue)

    def _run(self) -> None:
        while self._running:
            due_item = None
            with self._lock:
                if self._queue and self._queue[0].scheduled_time <= time.monotonic():
                    due_item = self._queue.popleft()
            if due_item is not None:
                try:
                    self._controller.trigger_reject(self._pulse_ms)
                    self.rejected_count += 1
                    logger.info("Rejected %s (reason: %s)", due_item.product_id, due_item.reason)
                except Exception:
                    logger.exception("Failed to trigger reject for %s", due_item.product_id)
            else:
                time.sleep(self._poll_interval_s)
