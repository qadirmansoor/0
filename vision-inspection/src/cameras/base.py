from abc import ABC, abstractmethod
from typing import Optional

import numpy as np


class CameraError(Exception):
    """Raised for camera connect/capture failures."""


class CameraBase(ABC):
    """Common interface for all camera sources (builtin, USB3, IP)."""

    def __init__(self, name: str):
        self.name = name
        self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    @abstractmethod
    def connect(self) -> None:
        """Open the device/stream. Raises CameraError on failure."""

    @abstractmethod
    def disconnect(self) -> None:
        """Release the device/stream."""

    @abstractmethod
    def read_frame(self) -> Optional[np.ndarray]:
        """Return the next frame as a BGR numpy array, or None if unavailable."""

    def __enter__(self) -> "CameraBase":
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.disconnect()
