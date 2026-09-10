import json
import os
from typing import Any, Dict, List

from .config import settings


def _load_regions_file() -> Dict[str, Any]:
    file_path = os.path.join(settings.data_dir, "regions.json")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_regions() -> List[Dict[str, Any]]:
    return _load_regions_file().get("regions", [])


def get_region(region_id: str) -> Dict[str, Any]:
    for region in list_regions():
        if region.get("id") == region_id:
            return region
    available = ", ".join(region.get("id", "") for region in list_regions())
    raise KeyError(f"Unknown region '{region_id}'. Available: {available}")


def get_default_region_id() -> str:
    regions = list_regions()
    if not regions:
        raise RuntimeError("regions.json has no entries")
    return regions[0]["id"]
