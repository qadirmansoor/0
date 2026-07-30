from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .models import InspectionResult


class InspectorBase(ABC):
    @abstractmethod
    def inspect(self, frame: np.ndarray) -> InspectionResult:
        ...


class BasicCVInspector(InspectorBase):
    """Classic-CV inspector for common pharma packaging defects:
      - out-of-focus/blurred frame (bad capture, not a product decision)
      - missing/incomplete print or contents (large dark/blank regions)
      - contamination or foreign particles (unexpected blobs vs. reference)
      - gross misalignment (via reference-image template matching, if configured)

    This is intentionally a transparent, tunable baseline. Swap in an
    ML/ONNX model behind the same `inspect()` interface for more nuanced
    defect classes (e.g. blister cavity fill, label OCR/verification)
    without touching the pipeline.
    """

    def __init__(self, config: Dict[str, Any]):
        self._min_confidence = float(config.get("min_confidence", 0.8))
        self._blur_threshold = float(config.get("blur_threshold", 100.0))
        self._min_defect_area_px = int(config.get("min_defect_area_px", 40))
        self._reference_path = config.get("reference_image") or None
        self._reference = None
        if self._reference_path:
            import cv2

            self._reference = cv2.imread(self._reference_path, cv2.IMREAD_GRAYSCALE)

    def inspect(self, frame: np.ndarray) -> InspectionResult:
        import cv2

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        defects: List[str] = []

        focus_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if focus_score < self._blur_threshold:
            defects.append(f"blurred_capture(focus={focus_score:.1f})")

        defects.extend(self._detect_blob_defects(gray))

        if self._reference is not None:
            match_score = self._match_reference(gray)
            if match_score < self._min_confidence:
                defects.append(f"misaligned_or_mismatched(score={match_score:.2f})")
            confidence = match_score
        else:
            confidence = 1.0 - min(len(defects) * 0.25, 1.0)

        passed = not defects and confidence >= self._min_confidence
        return InspectionResult(passed=passed, confidence=confidence, defects=defects)

    def _detect_blob_defects(self, gray: np.ndarray) -> List[str]:
        """Flags contamination/foreign-particle-style blobs via adaptive thresholding."""
        blurred = self._cv().GaussianBlur(gray, (5, 5), 0)
        thresh = self._cv().adaptiveThreshold(
            blurred, 255, self._cv().ADAPTIVE_THRESH_GAUSSIAN_C, self._cv().THRESH_BINARY_INV, 25, 5
        )
        contours, _ = self._cv().findContours(thresh, self._cv().RETR_EXTERNAL, self._cv().CHAIN_APPROX_SIMPLE)

        defects = []
        for contour in contours:
            area = self._cv().contourArea(contour)
            if area >= self._min_defect_area_px:
                x, y, w, h = self._cv().boundingRect(contour)
                defects.append(f"blob_defect(area={int(area)},x={x},y={y},w={w},h={h})")
        return defects

    def _match_reference(self, gray: np.ndarray) -> float:
        cv2 = self._cv()
        reference = cv2.resize(self._reference, (gray.shape[1], gray.shape[0]))
        result = cv2.matchTemplate(gray, reference, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(result)
        return float(max_val)

    @staticmethod
    def _cv():
        import cv2

        return cv2
