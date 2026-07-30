from pathlib import Path
from typing import Any, Dict

import yaml


def load_config(path: str | Path) -> Dict[str, Any]:
    """Load the system YAML config into a plain nested dict.

    Component factories each read their own subsection (config["camera"],
    config["printer"], config["rejection"], ...), so no schema/dataclass
    layer is needed here.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with path.open("r") as f:
        data = yaml.safe_load(f) or {}
    return data
