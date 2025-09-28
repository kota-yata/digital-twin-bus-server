import json
import os
import sys
import time
from datetime import datetime, timedelta
import math
from pprint import pprint
import threading
from uuid import uuid4
from pathlib import Path

import boto3
from awscrt import auth, io, mqtt
from awscrt.exceptions import AwsCrtError
from awsiot import mqtt_connection_builder
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

def _load_dotenv(path: str = ".env") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)

_load_dotenv()

refresh_token = os.getenv("REFRESH_TOKEN", "")
region = os.getenv("REGION", "ap-northeast-1")
user_pool_id = os.getenv("USER_POOL_ID", "ap-northeast-1_kRWuig6oV")
user_pool_client_id = os.getenv("USER_POOL_CLIENT_ID", "2jl8m0q968eudj7lubpdkuvq9v")
identity_pool_id = os.getenv("IDENTITY_POOL_ID", "ap-northeast-1:7e24baf3-0e4b-4c3a-bacf-ca1e9b7f4650")
endpoint = os.getenv("ENDPOINT", "ak6s01k4r928v-ats.iot.ap-northeast-1.amazonaws.com")
message_topic = os.getenv("MESSAGE_TOPIC", "object/lidar/vista-p90-3/person")
client_id = os.getenv("CLIENT_ID", "sample-" + str(uuid4()))

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def fetch_id_token(refresh_token: str,
                   user_pool_client_id: str,
                   region: str = "ap-northeast-1") -> str:
    client = boto3.client("cognito-idp", region_name=region)
    response: dict = client.initiate_auth(
        AuthFlow='REFRESH_TOKEN_AUTH',
        AuthParameters={'REFRESH_TOKEN': refresh_token},
        ClientId=user_pool_client_id
    )
    return response['AuthenticationResult']['IdToken']


def fetch_identity_id(id_token: str,
                      user_pool_id: str,
                      identity_pool_id: str,
                      region: str = "ap-northeast-1") -> str:
    client = boto3.client("cognito-identity", region_name=region)
    response = client.get_id(
        IdentityPoolId=identity_pool_id,
        Logins={f"cognito-idp.{region}.amazonaws.com/{user_pool_id}": id_token}
    )
    return response['IdentityId']


def on_connection_interrupted(connection: mqtt.Connection,
                              error: AwsCrtError,
                              **kwargs) -> None:
    print(f"Connection interrupted. error: {error}")


def on_connection_resumed(connection: mqtt.Connection,
                          return_code: mqtt.ConnectReturnCode,
                          session_present: bool,
                          **kwargs) -> None:
    print("Connection resumed. "
          f"return_code: {return_code} session_present: {session_present}")


def on_message_received(topic: str,
                        payload: bytes,
                        dup: bool,
                        qos: mqtt.QoS,
                        retain: bool,
                        **kwargs) -> None:
    print(f"Received message from topic '{topic}'")
    try:
        decoded_payload = json.loads(payload)
        count = len(decoded_payload.get("objects", []))
    except Exception as e:
        print(f"Failed to decode payload: {e}", file=sys.stderr)
        count = 0
    global latest_object_count
    latest_object_count = count
    pprint(latest_object_count)


def connect_and_subscribe():
    id_token = fetch_id_token(
        refresh_token=refresh_token,
        user_pool_client_id=user_pool_client_id,
        region=region,
    )

    global identity_id
    if identity_id is None:
        identity_id = fetch_identity_id(
            id_token=id_token,
            user_pool_id=user_pool_id,
            identity_pool_id=identity_pool_id,
            region=region,
        )

    credentials_provider = auth.AwsCredentialsProvider.new_cognito(
        endpoint=f"cognito-identity.{region}.amazonaws.com",
        identity=identity_id,
        tls_ctx=io.ClientTlsContext(io.TlsContextOptions()),
        logins=[
            (f"cognito-idp.{region}.amazonaws.com/{user_pool_id}",
                id_token),
        ]
    )

    mqtt_connection = mqtt_connection_builder.websockets_with_default_aws_signing(
        endpoint=endpoint,
        client_id=client_id,
        region=region,
        credentials_provider=credentials_provider,
        on_connection_interrupted=on_connection_interrupted,
        on_connection_resumed=on_connection_resumed,
        clean_session=False,
        reconnect_min_timeout_secs=1,
        keep_alive_secs=30,
    )

    connect_future = mqtt_connection.connect()
    connect_future.result()
    print("Connected!")

    print("Subscribing to topic '{}'...".format(message_topic))
    subscribe_future, packet_id = mqtt_connection.subscribe(
        topic=message_topic,
        qos=mqtt.QoS.AT_MOST_ONCE,
        callback=on_message_received)
    try:
        subscribe_result = subscribe_future.result()
        print(f"Subscribed with QoS {subscribe_result['qos']}")
        while True:
            time.sleep(1)

    except Exception as e:
        print(e, file=sys.stderr)
    finally:
        print("Disconnecting...")
        disconnect_future = mqtt_connection.disconnect()
        disconnect_future.result()
        print("Disconnected!")


TIMETABLE = {
    "湘23": {
        "weekday": {
            14: [39, 59],
            15: [8, 50, 56],
            16: [18],
            19: [50],
            20: [5, 20, 35, 50],
            21: [0, 15, 35, 50],
            22: [35],
        },
        "saturday": {
            13: [13, 17, 21],
            14: [20],
            15: [20],
            16: [20],
            17: [20],
            18: [20],
            19: [17, 47],
            20: [12],
        },
        "holiday": {},
    },
    "湘25": {
        "weekday": {
            14: [29, 49],
            15: [16, 24, 31, 38, 45],
            16: [4, 14, 24, 31, 39, 47, 55],
            17: [5, 15, 23, 30, 37, 45, 53],
            18: [1, 9, 16, 23, 30, 37, 50],
            19: [5, 30],
        },
        "saturday": {
            12: [48, 55],
            13: [2, 9, 27, 35, 43, 51],
            14: [0, 10, 27, 47],
            15: [7, 40, 55],
            16: [10, 40, 55],
            17: [10, 35, 50],
            18: [5, 40, 55],
        },
        "holiday": {},
    },
    "湘28": {
        "weekday": {
            15: [28, 34],
            18: [11, 42],
        },
        "saturday": {},
        "holiday": {},
    },
}


def _now_in_tz(tz_name: str) -> datetime:
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


def _expand_day_departures(line_name: str, day_start: datetime, day_type: str) -> list[datetime]:
    table = (TIMETABLE.get(line_name, {}).get(day_type)) or {}
    out: list[datetime] = []
    for h in range(0, 25):
        mins = table.get(h)
        if not mins:
            continue
        for m in mins:
            dt = day_start.replace(hour=h, minute=m, second=0, microsecond=0)
            out.append(dt)
    out.sort()
    return out


def next_buses(line_name: str, from_date: datetime | None = None, count: int = 5) -> list[dict]:
    if line_name not in TIMETABLE:
        raise KeyError(f"未知の系統: {line_name}")
    if from_date is None:
        from_date = _now_in_tz(os.environ.get("TZ", "Asia/Tokyo"))

    results: list[dict] = []
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


def next_across_all(from_date: datetime | None = None, count: int = 5) -> list[dict]:
    lines = list(TIMETABLE.keys())
    if from_date is None:
        from_date = _now_in_tz(os.environ.get("TZ", "Asia/Tokyo"))
    bucket: list[dict] = []
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


def shape_item(now: datetime, item: dict, tz_name: str = "Asia/Tokyo") -> dict:
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


HELLO_INFO_URL = "https://api-public.odpt.org/api/v4/gbfs/hellocycling/station_information.json"
HELLO_STATUS_URL = "https://api-public.odpt.org/api/v4/gbfs/hellocycling/station_status.json"

SFC = (35.3881, 139.4270)
SHONANDAI = (35.3949, 139.4653)


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def compute_bike_metrics() -> dict:
    info = requests.get(HELLO_INFO_URL, timeout=10).json()
    status = requests.get(HELLO_STATUS_URL, timeout=10).json()

    stations = info.get("data", {}).get("stations", [])
    statuses = status.get("data", {}).get("stations", [])
    status_by_id = {s.get("station_id"): s for s in statuses}

    merged = []
    for st in stations:
        sid = st.get("station_id")
        if not sid or sid not in status_by_id:
            continue
        lat = st.get("lat")
        lon = st.get("lon")
        if lat is None or lon is None:
            continue
        st_status = status_by_id[sid]
        nba = st_status.get("num_bikes_available", 0) or 0
        if "num_docks_available" in st_status:
            returnable = st_status.get("num_docks_available", 0) or 0
        else:
            cap = st.get("capacity", 0) or 0
            returnable = max(0, cap - nba)
        merged.append({
            "name": st.get("name"),
            "lat": lat,
            "lon": lon,
            "num_bikes_available": int(nba),
            "returnable": int(returnable),
        })

    nearest_sfc = min(
        merged,
        key=lambda r: _haversine_m(SFC[0], SFC[1], r["lat"], r["lon"]) if r else float("inf"),
    ) if merged else None

    total_available = int(nearest_sfc.get("num_bikes_available", 0)) if nearest_sfc else 0

    total_returnable = 0
    for r in merged:
        d = _haversine_m(SHONANDAI[0], SHONANDAI[1], r["lat"], r["lon"]) 
        if d < 500:
            total_returnable += int(r.get("returnable", 0))

    return {
        "total_available": total_available,
        "total_returnable": total_returnable,
    }


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
    level = _classify_level(latest_object_count)
    return {"count": latest_object_count, "level": level}

@app.get("/bus")
def get_bus():
    now = _now_in_tz(os.environ.get("TZ", "Asia/Tokyo"))
    items = next_across_all(now, 5)
    shaped = [shape_item(now, it, os.environ.get("TZ", "Asia/Tokyo")) for it in items]
    return {"from": now.isoformat(), "count": len(shaped), "items": shaped}

@app.get("/bike")
def get_bike():
    try:
        return compute_bike_metrics()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


def subscriber_loop():
    global identity_id
    identity_id = None

    backoff_time = 1
    while True:
        try:
            connect_and_subscribe()
        except Exception as e:
            print(e, file=sys.stderr)
        time.sleep(backoff_time)
        backoff_time = min(backoff_time * 2, 600)

latest_object_count = 0


@app.on_event("startup")
def _startup():
    t = threading.Thread(target=subscriber_loop, daemon=True)
    t.start()

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
