from typing import Any, Dict, Optional

import numpy as np

from .base import CameraBase, CameraError


class USB3Camera(CameraBase):
    """USB3 industrial camera.

    Supports two drivers, selected via config["driver"]:
      - "opencv":  generic UVC-class USB3 camera, opened through OpenCV.
                   Good for USB3 webcam-style machine vision cameras.
      - "genicam": USB3 Vision / GenICam camera accessed through the
                   Harvesters library and a vendor .cti GenTL producer
                   (e.g. from Basler, FLIR, Teledyne). Gives access to
                   exposure/gain and hardware trigger controls.
    """

    def __init__(self, config: Dict[str, Any]):
        driver = config.get("driver", "opencv")
        super().__init__(name=f"usb3-{driver}")
        self._driver = driver
        self._config = config
        self._cap = None          # opencv backend
        self._harvester = None    # genicam backend
        self._acquirer = None     # genicam backend

    def connect(self) -> None:
        if self._driver == "opencv":
            self._connect_opencv()
        elif self._driver == "genicam":
            self._connect_genicam()
        else:
            raise CameraError(f"Unknown USB3 camera driver: {self._driver}")
        self._connected = True

    def _connect_opencv(self) -> None:
        import cv2

        index = int(self._config.get("device_index", 0))
        cap = cv2.VideoCapture(index, cv2.CAP_ANY)
        if not cap.isOpened():
            raise CameraError(f"Unable to open USB3 camera at index {index}")
        width = self._config.get("width")
        height = self._config.get("height")
        fps = self._config.get("fps")
        if width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        if height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if fps:
            cap.set(cv2.CAP_PROP_FPS, fps)
        self._cap = cap

    def _connect_genicam(self) -> None:
        try:
            from harvesters.core import Harvester
        except ImportError as exc:
            raise CameraError(
                "GenICam driver requires the 'harvesters' package "
                "(pip install harvesters) plus a vendor .cti GenTL producer."
            ) from exc

        cti_file = self._config.get("cti_file")
        if not cti_file:
            raise CameraError("usb3.cti_file must be set for the genicam driver")

        h = Harvester()
        h.add_file(cti_file)
        h.update()
        if not h.device_info_list:
            h.reset()
            raise CameraError("No GenICam/USB3 Vision devices found")

        device_index = int(self._config.get("genicam_device_index", 0))
        acquirer = h.create(device_index)

        exposure_us = self._config.get("exposure_us")
        gain_db = self._config.get("gain_db")
        node_map = acquirer.remote_device.node_map
        try:
            if exposure_us is not None and hasattr(node_map, "ExposureTime"):
                node_map.ExposureTime.value = float(exposure_us)
            if gain_db is not None and hasattr(node_map, "Gain"):
                node_map.Gain.value = float(gain_db)
        except Exception:
            pass  # Not all cameras expose these nodes under these exact names.

        acquirer.start()
        self._harvester = h
        self._acquirer = acquirer

    def disconnect(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        if self._acquirer is not None:
            try:
                self._acquirer.stop()
                self._acquirer.destroy()
            finally:
                self._acquirer = None
        if self._harvester is not None:
            self._harvester.reset()
            self._harvester = None
        self._connected = False

    def read_frame(self) -> Optional[np.ndarray]:
        if not self._connected:
            raise CameraError("Camera is not connected")

        if self._driver == "opencv":
            ok, frame = self._cap.read()
            return frame if ok else None

        # genicam
        import cv2

        with self._acquirer.fetch(timeout=2) as buffer:
            component = buffer.payload.components[0]
            width, height = component.width, component.height
            image = component.data.reshape(height, width, -1)
            if image.shape[2] == 1:
                frame = cv2.cvtColor(image, cv2.COLOR_BAYER_BG2BGR)
            else:
                frame = image.copy()
        return frame
