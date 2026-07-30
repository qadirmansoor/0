from typing import Any, Dict

from .base import CameraBase, CameraError
from .builtin_camera import BuiltinCamera
from .ip_camera import IPCamera
from .usb3_camera import USB3Camera


def create_camera(config: Dict[str, Any]) -> CameraBase:
    """Build the configured camera source.

    config is the top-level "camera" section, e.g.:
        {"type": "builtin", "builtin": {...}, "usb3": {...}, "ip": {...}}
    """
    camera_type = config.get("type")
    if camera_type == "builtin":
        return BuiltinCamera(config.get("builtin", {}))
    if camera_type == "usb3":
        return USB3Camera(config.get("usb3", {}))
    if camera_type == "ip":
        return IPCamera(config.get("ip", {}))
    raise CameraError(f"Unknown camera type: {camera_type!r} (expected builtin, usb3, or ip)")
