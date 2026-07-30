import time
import uuid
from dataclasses import dataclass, field
from typing import List


@dataclass
class InspectionResult:
    passed: bool
    confidence: float
    defects: List[str] = field(default_factory=list)
    product_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    timestamp: float = field(default_factory=time.time)
