import time

from src.rejection.delay_queue import RejectDelayQueue, compute_delay_ms


class FakeController:
    def __init__(self):
        self.triggers = []

    def trigger_reject(self, pulse_ms):
        self.triggers.append((time.monotonic(), pulse_ms))


def test_compute_delay_ms_fixed():
    assert compute_delay_ms({"mode": "fixed_ms", "fixed_ms": 500}) == 500


def test_compute_delay_ms_conveyor_speed():
    delay = compute_delay_ms(
        {"mode": "conveyor_speed", "camera_to_reject_mm": 300, "conveyor_speed_mm_s": 300}
    )
    assert delay == 1000  # 300mm at 300mm/s = 1s = 1000ms


def test_delay_queue_fires_after_delay():
    controller = FakeController()
    queue = RejectDelayQueue(controller, pulse_ms=100, poll_interval_s=0.005)
    queue.start()
    try:
        start = time.monotonic()
        queue.schedule(delay_ms=50, product_id="p1", reason="test")
        deadline = time.monotonic() + 1
        while not controller.triggers and time.monotonic() < deadline:
            time.sleep(0.01)
        assert controller.triggers, "reject was never triggered"
        fired_at, pulse_ms = controller.triggers[0]
        assert pulse_ms == 100
        assert fired_at - start >= 0.04  # allow small scheduling jitter
    finally:
        queue.stop()


def test_delay_queue_preserves_fifo_order():
    controller = FakeController()
    queue = RejectDelayQueue(controller, pulse_ms=10, poll_interval_s=0.005)
    queue.start()
    try:
        queue.schedule(delay_ms=10, product_id="a", reason="test")
        queue.schedule(delay_ms=30, product_id="b", reason="test")
        time.sleep(0.2)
        assert len(controller.triggers) == 2
    finally:
        queue.stop()
