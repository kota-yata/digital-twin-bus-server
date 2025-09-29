import os
import requests

HELLO_INFO_URL = "https://api-public.odpt.org/api/v4/gbfs/hellocycling/station_information.json"
HELLO_STATUS_URL = "https://api-public.odpt.org/api/v4/gbfs/hellocycling/station_status.json"

# Constants (no env)
SFC_STATION_ID = "5143"
SHONANDAI_TIER1_STATION_IDS = ["5609", "7395", "11403", "16084"]
SHONANDAI_TIER2_STATION_IDS = ["12189", "5113", "12189", "4035", "11908"]


def compute_bike_metrics() -> dict:
    info = requests.get(HELLO_INFO_URL, timeout=10).json()
    status = requests.get(HELLO_STATUS_URL, timeout=10).json()

    stations = info.get("data", {}).get("stations", [])
    statuses = status.get("data", {}).get("stations", [])
    status_by_id = {s.get("station_id"): s for s in statuses}
    info_by_id = {s.get("station_id"): s for s in stations}

    sfc_station_id = SFC_STATION_ID

    def returnable_for(sid: str) -> int:
        st_status = status_by_id.get(sid) or {}
        if not st_status:
            return 0
        if "num_docks_available" in st_status:
            return int(st_status.get("num_docks_available", 0) or 0)
        cap = (info_by_id.get(sid) or {}).get("capacity", 0) or 0
        nba = int(st_status.get("num_bikes_available", 0) or 0)
        return max(0, int(cap) - int(nba))

    # total_available: bikes at fixed SFC station id
    if sfc_station_id and sfc_station_id in status_by_id:
        total_available = int((status_by_id.get(sfc_station_id) or {}).get("num_bikes_available", 0) or 0)
    else:
        total_available = 0

    primary_ids = SHONANDAI_TIER1_STATION_IDS
    secondary_ids = SHONANDAI_TIER2_STATION_IDS

    total_returnable_primary = sum(returnable_for(sid) for sid in primary_ids)
    total_returnable_secondary = sum(returnable_for(sid) for sid in secondary_ids)

    return {
        "total_available": int(total_available),
        "returnable_primary": int(total_returnable_primary),
        "returnable_secondary": int(total_returnable_secondary),
    }


def compute_bike_metrics_directional() -> dict:
    info = requests.get(HELLO_INFO_URL, timeout=10).json()
    status = requests.get(HELLO_STATUS_URL, timeout=10).json()

    stations = info.get("data", {}).get("stations", [])
    statuses = status.get("data", {}).get("stations", [])
    status_by_id = {s.get("station_id"): s for s in statuses}
    info_by_id = {s.get("station_id"): s for s in stations}

    sfc_station_id = SFC_STATION_ID

    def rentable_for(sid: str) -> int:
        s = status_by_id.get(sid) or {}
        return int(s.get("num_bikes_available", 0) or 0)

    def returnable_for(sid: str) -> int:
        s = status_by_id.get(sid) or {}
        if not s:
            return 0
        if "num_docks_available" in s:
            return int(s.get("num_docks_available", 0) or 0)
        cap = (info_by_id.get(sid) or {}).get("capacity", 0) or 0
        nba = int(s.get("num_bikes_available", 0) or 0)
        return max(0, int(cap) - int(nba))

    primary_ids = SHONANDAI_TIER1_STATION_IDS
    secondary_ids = SHONANDAI_TIER2_STATION_IDS

    sfc_rentable = rentable_for(sfc_station_id) if sfc_station_id in status_by_id else 0
    sfc_returnable = returnable_for(sfc_station_id) if sfc_station_id in status_by_id else 0

    shonan_rentable_primary = sum(rentable_for(sid) for sid in primary_ids)
    shonan_rentable_secondary = sum(rentable_for(sid) for sid in secondary_ids)
    shonan_returnable_primary = sum(returnable_for(sid) for sid in primary_ids)
    shonan_returnable_secondary = sum(returnable_for(sid) for sid in secondary_ids)

    return {
        "go": {
            "sfc_returnable": int(sfc_returnable),
            "shonandai_rentable": {
                "primary": int(shonan_rentable_primary),
                "secondary": int(shonan_rentable_secondary),
            },
        },
        "back": {
            "sfc_rentable": int(sfc_rentable),
            "shonandai_returnable": {
                "primary": int(shonan_returnable_primary),
                "secondary": int(shonan_returnable_secondary),
            },
        },
    }

