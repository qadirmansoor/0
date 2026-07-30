import time
from typing import Any, Dict, Optional

import numpy as np

from .base import CameraBase, CameraError
from ..utils.logger import get_logger

logger = get_logger(__name__)


class IPCamera(CameraBase):
    """Network camera (RTSP/HTTP/ONVIF stream URL), with auto-reconnect."""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(name="ip")
        self._url = config["url"]
        self._reconnect_interval_s = float(config.get("reconnect_interval_s", 5))
        self._connect_timeout_s = float(config.get("connect_timeout_s", 10))
        self._max_reconnect_attempts = int(config.get("max_reconnect_attempts", 0))
        self._cap = None

    def connect(self) -> None:
        import cv2

        cap = cv2.VideoCapture(self._url, cv2.CAP_FFMPEG)
        deadline = time.monotonic() + self._connect_timeout_s
        while not cap.isOpened() and time.monotonic() < deadline:
            time.sleep(0.2)
            cap.open(self._url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            raise CameraError(f"Unable to open IP camera stream: {self._url}")
        self._cap = cap
        self._connected = True

    def disconnect(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._connected = False

    def read_frame(self) -> Optional[np.ndarray]:
        if not self._connected or self._cap is None:
            raise CameraError("Camera is not connected")

        ok, frame = self._cap.read()
        if ok:
            return frame

        logger.warning("IP camera stream dropped, attempting reconnect: %s", self._url)
        return self._reconnect_and_read()

    def _reconnect_and_read(self) -> Optional[np.ndarray]:
        import cv2

        attempts = 0
        while self._max_reconnect_attempts == 0 or attempts < self._max_reconnect_attempts:
            attempts += 1
            try:
                if self._cap is not None:
                    self._cap.release()
                self._cap = cv2.VideoCapture(self._url, cv2.CAP_FFMPEG)
                if self._cap.isOpened():
                    ok, frame = self._cap.read()
                    if ok:
                        logger.info("IP camera reconnected after %d attempt(s)", attempts)
                        return frame
            except Exception as exc:
                logger.warning("IP camera reconnect attempt %d failed: %s", attempts, exc)
            time.sleep(self._reconnect_interval_s)

        raise CameraError(f"Failed to reconnect to IP camera after {attempts} attempts: {self._url}")
