import threading
import time
from typing import Any, Dict

from .base import RejectionControllerBase, RejectionError
from ..utils.logger import get_logger

logger = get_logger(__name__)


class RaspberryPiRejectionController(RejectionControllerBase):
    """Drives a reject actuator (relay -> solenoid/air-blast/pusher) from a
    Raspberry Pi GPIO pin. Supports gpiozero (default) or RPi.GPIO."""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(name="raspberrypi")
        self._pin = int(config["reject_gpio_pin"])
        self._active_high = bool(config.get("active_high", True))
        self._backend_name = config.get("backend", "gpiozero")
        self._backend = None
        self._lock = threading.Lock()

    def connect(self) -> None:
        if self._backend_name == "gpiozero":
            self._connect_gpiozero()
        elif self._backend_name == "rpigpio":
            self._connect_rpigpio()
        else:
            raise RejectionError(f"Unknown Raspberry Pi GPIO backend: {self._backend_name}")
        self._connected = True
        logger.info("Raspberry Pi reject controller ready on GPIO%d (%s)", self._pin, self._backend_name)

    def _connect_gpiozero(self) -> None:
        try:
            from gpiozero import OutputDevice
        except ImportError as exc:
            raise RejectionError("gpiozero is required (pip install gpiozero)") from exc

        device = OutputDevice(self._pin, active_high=self._active_high, initial_value=False)
        self._backend = ("gpiozero", device)

    def _connect_rpigpio(self) -> None:
        try:
            import RPi.GPIO as GPIO
        except ImportError as exc:
            raise RejectionError("RPi.GPIO is required (pip install RPi.GPIO)") from exc

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self._pin, GPIO.OUT, initial=GPIO.LOW)
        self._backend = ("rpigpio", GPIO)

    def disconnect(self) -> None:
        if self._backend is not None:
            kind, handle = self._backend
            if kind == "gpiozero":
                handle.off()
                handle.close()
            elif kind == "rpigpio":
                handle.output(self._pin, handle.LOW)
                handle.cleanup(self._pin)
            self._backend = None
        self._connected = False

    def trigger_reject(self, pulse_ms: int) -> None:
        if not self._connected or self._backend is None:
            raise RejectionError("Raspberry Pi controller is not connected")

        kind, handle = self._backend

        def _pulse() -> None:
            with self._lock:
                if kind == "gpiozero":
                    handle.on()
                    time.sleep(pulse_ms / 1000)
                    handle.off()
                else:  # rpigpio
                    level = handle.HIGH if self._active_high else handle.LOW
                    off_level = handle.LOW if self._active_high else handle.HIGH
                    handle.output(self._pin, level)
                    time.sleep(pulse_ms / 1000)
                    handle.output(self._pin, off_level)

        threading.Thread(target=_pulse, daemon=True).start()

    def get_status(self) -> dict:
        return {"connected": self._connected, "pin": self._pin, "backend": self._backend_name}
