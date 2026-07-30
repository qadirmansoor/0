from typing import Any, Dict, Optional

import numpy as np

from .base import CameraBase, CameraError


class BuiltinCamera(CameraBase):
    """Laptop/embedded built-in camera, or any plain UVC webcam, via OpenCV."""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(name="builtin")
        self._index = int(config.get("index", 0))
        self._width = config.get("width")
        self._height = config.get("height")
        self._cap = None

    def connect(self) -> None:
        import cv2

        cap = cv2.VideoCapture(self._index)
        if not cap.isOpened():
            raise CameraError(f"Unable to open builtin camera at index {self._index}")
        if self._width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
        if self._height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
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
        if not ok:
            return None
        return frame
