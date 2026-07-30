import threading
import time
from typing import Any, Dict

from .base import RejectionControllerBase, RejectionError
from ..utils.logger import get_logger

logger = get_logger(__name__)


class PLCRejectionController(RejectionControllerBase):
    """Drives a reject actuator through a PLC coil over Modbus TCP.

    Activation: writes True to `reject_coil_address` to energize the
    reject output (solenoid/pusher/air-blast via the PLC's own I/O),
    then writes False after `pulse_ms` to release it.

    Optionally also pushes the computed reject delay (ms) into a PLC
    holding register (`delay_register_address`) so PLC-side rungs/timers
    that manage the physical delay line can pick it up, for lines where
    the PLC -- not this host -- owns the delay timing.
    """

    def __init__(self, config: Dict[str, Any]):
        super().__init__(name="plc")
        self._ip = config["ip"]
        self._port = int(config.get("port", 502))
        self._unit_id = int(config.get("unit_id", 1))
        self._reject_coil = int(config["reject_coil_address"])
        self._delay_register = config.get("delay_register_address")
        self._timeout_s = float(config.get("timeout_s", 2))
        self._client = None
        self._lock = threading.Lock()

    def connect(self) -> None:
        try:
            from pymodbus.client import ModbusTcpClient
        except ImportError as exc:
            raise RejectionError("pymodbus is required for the PLC controller (pip install pymodbus)") from exc

        client = ModbusTcpClient(self._ip, port=self._port, timeout=self._timeout_s)
        if not client.connect():
            raise RejectionError(f"Unable to connect to PLC at {self._ip}:{self._port}")
        self._client = client
        self._connected = True
        logger.info("Connected to PLC at %s:%s (unit %d)", self._ip, self._port, self._unit_id)

    def disconnect(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
        self._connected = False

    def push_delay_ms(self, delay_ms: int) -> None:
        if self._delay_register is None or self._client is None:
            return
        result = self._client.write_register(self._delay_register, int(delay_ms), slave=self._unit_id)
        if result.isError():
            logger.warning("Failed to write delay register: %s", result)

    def trigger_reject(self, pulse_ms: int) -> None:
        if not self._connected or self._client is None:
            raise RejectionError("PLC controller is not connected")

        def _pulse() -> None:
            with self._lock:
                on = self._client.write_coil(self._reject_coil, True, slave=self._unit_id)
                if on.isError():
                    logger.error("Failed to energize reject coil %d: %s", self._reject_coil, on)
                    return
                time.sleep(pulse_ms / 1000)
                off = self._client.write_coil(self._reject_coil, False, slave=self._unit_id)
                if off.isError():
                    logger.error("Failed to de-energize reject coil %d: %s", self._reject_coil, off)

        threading.Thread(target=_pulse, daemon=True).start()

    def get_status(self) -> dict:
        return {
            "connected": self._connected,
            "ip": self._ip,
            "port": self._port,
            "reject_coil_address": self._reject_coil,
        }
