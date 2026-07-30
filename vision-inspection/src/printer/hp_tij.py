import socket
import threading
import time
from typing import Any, Dict

from ..utils.logger import get_logger

logger = get_logger(__name__)


class PrinterError(Exception):
    """Raised for HP TIJ connect/print/status failures."""


class HPTIJPrinter:
    """TCP/IP driver for an HP TIJ (Thermal InkJet) printhead controller.

    HP TIJ printheads are almost always embedded behind a vendor controller
    (e.g. a coder/marking system built around an HP TIJ cartridge) that
    exposes a TCP/IP command port. The exact command grammar is vendor
    specific, so the wire format here is a configurable template
    (config["field_template"]) rather than a hardcoded protocol -- point it
    at your controller's documented command set.

    Typical usage on a pharma line: print batch number / mfg date / expiry
    date / MRP / barcode onto each good unit as it passes the printer.
    """

    def __init__(self, config: Dict[str, Any]):
        self._ip = config["ip"]
        self._port = int(config.get("port", 9100))
        self._connect_timeout_s = float(config.get("connect_timeout_s", 5))
        self._send_timeout_s = float(config.get("send_timeout_s", 2))
        self._retries = int(config.get("retries", 3))
        self._encoding = config.get("encoding", "ascii")
        self._field_template = config.get(
            "field_template", "^JOB^BATCH={batch}^MFG={mfg_date}^EXP={exp_date}^MRP={mrp}^END\n"
        )
        self._sock: socket.socket | None = None
        self._lock = threading.Lock()

    @property
    def is_connected(self) -> bool:
        return self._sock is not None

    def connect(self) -> None:
        try:
            sock = socket.create_connection((self._ip, self._port), timeout=self._connect_timeout_s)
        except OSError as exc:
            raise PrinterError(f"Unable to connect to HP TIJ controller at {self._ip}:{self._port}: {exc}") from exc
        sock.settimeout(self._send_timeout_s)
        self._sock = sock
        logger.info("Connected to HP TIJ printer at %s:%s", self._ip, self._port)

    def disconnect(self) -> None:
        if self._sock is not None:
            try:
                self._sock.close()
            finally:
                self._sock = None

    def send_print_job(self, fields: Dict[str, Any]) -> None:
        """Format and send a print job. `fields` must satisfy field_template's placeholders."""
        try:
            payload = self._field_template.format(**fields)
        except KeyError as exc:
            raise PrinterError(f"Missing field {exc} required by printer field_template") from exc

        self._send(payload.encode(self._encoding))
        logger.debug("Sent print job: %s", payload.strip())

    def get_status(self) -> str:
        """Query controller status (ink level, alarms, ready state). Protocol-dependent."""
        response = self._send(b"^STATUS?\n", expect_reply=True)
        return response.decode(self._encoding, errors="replace").strip() if response else ""

    def clear_alarms(self) -> None:
        self._send(b"^CLR_ALARM\n")

    def _send(self, payload: bytes, expect_reply: bool = False) -> bytes:
        with self._lock:
            last_exc: Exception | None = None
            for attempt in range(1, self._retries + 1):
                try:
                    if self._sock is None:
                        self.connect()
                    self._sock.sendall(payload)
                    if expect_reply:
                        return self._sock.recv(4096)
                    return b""
                except OSError as exc:
                    last_exc = exc
                    logger.warning("Printer send attempt %d/%d failed: %s", attempt, self._retries, exc)
                    self.disconnect()
                    time.sleep(min(0.5 * attempt, 2))
            raise PrinterError(f"Failed to communicate with HP TIJ printer after {self._retries} attempts") from last_exc

    def __enter__(self) -> "HPTIJPrinter":
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.disconnect()
