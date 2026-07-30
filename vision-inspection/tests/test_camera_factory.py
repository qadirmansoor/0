import pytest

from src.cameras.base import CameraError
from src.cameras.builtin_camera import BuiltinCamera
from src.cameras.factory import create_camera
from src.cameras.ip_camera import IPCamera
from src.cameras.usb3_camera import USB3Camera


def test_factory_builds_builtin_camera():
    cam = create_camera({"type": "builtin", "builtin": {"index": 0}})
    assert isinstance(cam, BuiltinCamera)


def test_factory_builds_usb3_camera():
    cam = create_camera({"type": "usb3", "usb3": {"driver": "opencv", "device_index": 0}})
    assert isinstance(cam, USB3Camera)


def test_factory_builds_ip_camera():
    cam = create_camera({"type": "ip", "ip": {"url": "rtsp://example/stream"}})
    assert isinstance(cam, IPCamera)


def test_factory_rejects_unknown_type():
    with pytest.raises(CameraError):
        create_camera({"type": "bogus"})
