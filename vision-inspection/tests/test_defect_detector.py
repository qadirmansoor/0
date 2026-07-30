import numpy as np

from src.inspection.defect_detector import BasicCVInspector


def test_uniform_focused_frame_passes():
    # A sharp checkerboard-ish pattern with enough local variance to pass
    # the blur check, and no isolated dark blobs to trip the contamination check.
    rng = np.random.default_rng(0)
    frame = rng.integers(100, 156, size=(200, 200, 3), dtype=np.uint8)
    inspector = BasicCVInspector({"min_confidence": 0.5, "blur_threshold": 5.0, "min_defect_area_px": 999999})
    result = inspector.inspect(frame)
    assert result.passed is True
    assert result.defects == []


def test_flat_blurred_frame_fails():
    frame = np.full((200, 200, 3), 128, dtype=np.uint8)
    inspector = BasicCVInspector({"min_confidence": 0.8, "blur_threshold": 100.0})
    result = inspector.inspect(frame)
    assert result.passed is False
    assert any("blurred_capture" in d for d in result.defects)


def test_dark_blob_triggers_contamination_defect():
    frame = np.full((200, 200, 3), 220, dtype=np.uint8)
    frame[80:120, 80:120] = 10  # large dark contamination blob
    inspector = BasicCVInspector({"min_confidence": 0.5, "blur_threshold": 1.0, "min_defect_area_px": 50})
    result = inspector.inspect(frame)
    assert any("blob_defect" in d for d in result.defects)
    assert result.passed is False
