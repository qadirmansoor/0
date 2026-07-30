from typing import Any, Dict, Tuple

from .arduino_controller import ArduinoRejectionController
from .base import RejectionControllerBase, RejectionError
from .delay_queue import RejectDelayQueue, compute_delay_ms
from .plc_controller import PLCRejectionController
from .raspberry_pi_controller import RaspberryPiRejectionController


def create_rejection_controller(config: Dict[str, Any]) -> RejectionControllerBase:
    """config is the top-level "rejection" section."""
    rejection_type = config.get("type")
    if rejection_type == "arduino":
        return ArduinoRejectionController(config.get("arduino", {}))
    if rejection_type == "raspberrypi":
        return RaspberryPiRejectionController(config.get("raspberrypi", {}))
    if rejection_type == "plc":
        return PLCRejectionController(config.get("plc", {}))
    raise RejectionError(f"Unknown rejection type: {rejection_type!r} (expected arduino, raspberrypi, or plc)")


def create_rejection_system(config: Dict[str, Any]) -> Tuple[RejectionControllerBase, RejectDelayQueue, float]:
    """Build the reject actuator and its delay queue together.

    Returns (controller, delay_queue, delay_ms).
    """
    controller = create_rejection_controller(config)
    delay_config = config.get("delay", {})
    delay_ms = compute_delay_ms(delay_config)
    pulse_ms = int(delay_config.get("pulse_ms", 200))
    delay_queue = RejectDelayQueue(controller, pulse_ms=pulse_ms)
    return controller, delay_queue, delay_ms
