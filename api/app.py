import os
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from bus_data import TIMETABLE
from bus import now_in_tz, get_day_type, next_across_all, shape_item
from bike import compute_bike_metrics, compute_bike_metrics_directional
try:
    from mqtt_subscriber import start_subscriber, get_latest_object_count
except Exception:
    def start_subscriber() -> None:  # type: ignore
        return None

    def get_latest_object_count() -> int:  # type: ignore
        return 0


def _classify_level(count: int) -> str:
    if count < 10:
        return "low"
    if 10 <= count <= 20:
        return "mid"
    return "high"


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/congestion")
def get_congestion():
    count = get_latest_object_count()
    level = _classify_level(count)
    return {"count": count, "level": level}


@app.get("/bus")
def get_bus():
    now = now_in_tz(os.environ.get("TZ", "Asia/Tokyo"))
    items = next_across_all(now, 5)
    shaped = [shape_item(now, it, os.environ.get("TZ", "Asia/Tokyo")) for it in items]
    return {"from": now.isoformat(), "count": len(shaped), "items": shaped}


@app.get("/timetable")
def get_timetable():
    tz = os.environ.get("TZ", "Asia/Tokyo")
    now = now_in_tz(tz)
    day_type = get_day_type(now)
    return {
        "tz": tz,
        "dayTypeToday": day_type,
        "lines": list(TIMETABLE.keys()),
        "timetable": TIMETABLE,
    }


@app.get("/bike")
def get_bike():
    global _bike_cache, _bike_cache_ts
    now = time.time()
    if _bike_cache is not None and (now - _bike_cache_ts) < 60:
        return _bike_cache
    try:
        data = compute_bike_metrics()
        _bike_cache = data
        _bike_cache_ts = now
        return data
    except Exception as e:
        if _bike_cache is not None:
            return _bike_cache
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/bike-direction")
def get_bike_direction():
    global _bike2_cache, _bike2_cache_ts
    now = time.time()
    if _bike2_cache is not None and (now - _bike2_cache_ts) < 60:
        return _bike2_cache
    try:
        data = compute_bike_metrics_directional()
        _bike2_cache = data
        _bike2_cache_ts = now
        return data
    except Exception as e:
        if _bike2_cache is not None:
            return _bike2_cache
        raise HTTPException(status_code=502, detail=str(e))


_bike_cache = None  # type: ignore[var-annotated]
_bike_cache_ts: float = 0.0
_bike2_cache = None  # type: ignore[var-annotated]
_bike2_cache_ts: float = 0.0


@app.on_event("startup")
def _startup():
    start_subscriber()


if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
