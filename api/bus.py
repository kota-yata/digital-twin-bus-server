from datetime import datetime, timedelta
import os
from typing import List, Dict, Optional

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

from bus_data import TIMETABLE


def now_in_tz(tz_name: str) -> datetime:
    if ZoneInfo is None:
        return datetime.utcnow()
    try:
        return datetime.now(ZoneInfo(tz_name))
    except Exception:
        return datetime.now(ZoneInfo("Asia/Tokyo"))


def get_day_type(d: datetime) -> str:
    wd = d.weekday()
    if wd == 5:
        return "saturday"
    if wd == 6:
        return "holiday"
    return "weekday"


def _expand_day_departures(line_name: str, day_start: datetime, day_type: str) -> List[datetime]:
    table = (TIMETABLE.get(line_name, {}).get(day_type)) or {}
    out: List[datetime] = []
    for h in range(0, 25):
        mins = table.get(h)
        if not mins:
            continue
        for m in mins:
            dt = day_start.replace(hour=h, minute=m, second=0, microsecond=0)
            out.append(dt)
    out.sort()
    return out


def next_buses(line_name: str, from_date: Optional[datetime] = None, count: int = 5) -> List[Dict]:
    if line_name not in TIMETABLE:
        raise KeyError(f"未知の系統: {line_name}")
    if from_date is None:
        from_date = now_in_tz(os.environ.get("TZ", "Asia/Tokyo"))

    results: List[Dict] = []
    probe = from_date
    for day_offset in range(0, 7):
        if len(results) >= count:
            break
        day_start = probe.replace(hour=0, minute=0, second=0, microsecond=0)
        day_type = get_day_type(probe)
        deps = _expand_day_departures(line_name, day_start, day_type)
        filtered = [dt for dt in deps if (day_offset > 0 or dt >= from_date)]
        for dt in filtered:
            results.append({"line": line_name, "dayType": day_type, "datetime": dt})
            if len(results) >= count:
                break
        probe = day_start + timedelta(days=1)
    return results


def next_across_all(from_date: Optional[datetime] = None, count: int = 5) -> List[Dict]:
    lines = list(TIMETABLE.keys())
    if from_date is None:
        from_date = now_in_tz(os.environ.get("TZ", "Asia/Tokyo"))
    bucket: List[Dict] = []
    probe = from_date
    for day_offset in range(0, 7):
        if len(bucket) >= count:
            break
        day_start = probe.replace(hour=0, minute=0, second=0, microsecond=0)
        for line in lines:
            day_type = get_day_type(probe)
            deps = _expand_day_departures(line, day_start, day_type)
            filtered = [dt for dt in deps if (day_offset > 0 or dt >= from_date)]
            for dt in filtered:
                bucket.append({"line": line, "dayType": day_type, "datetime": dt})
        probe = day_start + timedelta(days=1)
    bucket.sort(key=lambda x: x["datetime"]) 
    return bucket[:count]


def shape_item(now: datetime, item: Dict, tz_name: str = "Asia/Tokyo") -> Dict:
    dt: datetime = item["datetime"]
    if ZoneInfo is not None:
        try:
            tz = ZoneInfo(tz_name)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            if now.tzinfo is None:
                now = now.replace(tzinfo=tz)
        except Exception:
            tz = ZoneInfo("Asia/Tokyo")
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            if now.tzinfo is None:
                now = now.replace(tzinfo=tz)

    minutes_until = max(0, round((dt - now).total_seconds() / 60))
    local_str = dt.strftime("%Y/%m/%d %H:%M")
    time_str = dt.strftime("%H:%M")
    return {
        "line": item["line"],
        "dayType": item["dayType"],
        "iso": dt.isoformat(),
        "local": local_str,
        "time": time_str,
        "minutesUntil": minutes_until,
    }
