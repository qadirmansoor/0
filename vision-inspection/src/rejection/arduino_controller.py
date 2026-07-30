import time
from typing import Any, Dict

from .base import RejectionControllerBase, RejectionError
from ..utils.logger import get_logger

logger = get_logger(__name__)


class ArduinoRejectionController(RejectionControllerBase):
    """Drives a reject actuator through an Arduino over USB serial.

    Wire protocol (simple, ack'd line protocol -- adjust to match your
    firmware sketch):
        host -> arduino:  "R,<pulse_ms>\\n"
        arduino -> host:  "OK\\n"   (once the pulse has been scheduled/completed)

    A matching example Arduino sketch would read a line, parse "R,<ms>",
    drive the reject relay/solenoid pin HIGH for <ms> milliseconds (or
    hand it to a non-blocking timer), then reply "OK".
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(name="arduino")
        self._port = config["port"]
        self._baudrate = int(config.get("baudrate", 115200))
        self._timeout_s = float(config.get("timeout_s", 1))
        self._ack_timeout_s = float(config.get("ack_timeout_s", 0.5))
        self._serial = None

    def connect(self) -> None:
        try:
            import serial
        except ImportError as exc:
            raise RejectionError("pyserial is required for the Arduino controller (pip install pyserial)") from exc

        try:
            self._serial = serial.Serial(self._port, self._baudrate, timeout=self._timeout_s)
        except serial.SerialException as exc:
            raise RejectionError(f"Unable to open serial port {self._port}: {exc}") from exc

        time.sleep(2)  # allow the Arduino to reset after the port opens
        self._connected = True
        logger.info("Connected to Arduino reject controller on %s @ %d baud", self._port, self._baudrate)

    def disconnect(self) -> None:
        if self._serial is not None:
            self._serial.close()
            self._serial = None
        self._connected = False

    def trigger_reject(self, pulse_ms: int) -> None:
        if not self._connected or self._serial is None:
            raise RejectionError("Arduino controller is not connected")

        command = f"R,{int(pulse_ms)}\n".encode("ascii")
        self._serial.write(command)

        self._serial.timeout = self._ack_timeout_s
        ack = self._serial.readline()
        if not ack.strip().startswith(b"OK"):
            logger.warning("Arduino reject command not acknowledged (got %r)", ack)

    def get_status(self) -> dict:
        return {"connected": self._connected, "port": self._port}
