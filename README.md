# Digital Twin Bus Server — HTTP API

This server exposes three JSON endpoints over HTTP:

- GET `/bus` — upcoming bus departures across all lines (next 5)
- GET `/congestion` — current congestion level derived from MQTT object count
- GET `/timetable` — raw timetable data for all lines
- GET `/bike` — HELLO CYCLING metrics near SFC and Shonandai

Base URL: `http://localhost:8000`

Content-Type: all responses are `application/json; charset=utf-8`.

Authentication: none.

Timezone: the server uses the `TZ` environment variable (default `Asia/Tokyo`).

---

## GET /bus

Returns the next 5 upcoming departures across all configured lines, sorted by time ascending.

Request
- Method: `GET`
- Path: `/bus`
- Query: none

Response 200
```
{
  "from": "2025-09-08T17:59:00+09:00",          // ISO-8601 server time when computed
  "count": 5,                                    // number of items returned (always 5)
  "items": [
    {
      "line": "湘25",                           // line identifier
      "dayType": "weekday|saturday|holiday",   // day category used for timetable
      "iso": "2025-09-08T18:01:00+09:00",      // ISO-8601 departure in server TZ
      "local": "2025/09/08 18:01",             // human-friendly local string
      "time": "18:01",                          // HH:MM local time
      "minutesUntil": 2                          // integer >= 0
    }
  ]
}
```

Notes
- Items are sorted ascending by `iso`/time.
- `minutesUntil` is rounded to the nearest minute, never negative.
- The timetable is static and embedded in the server.

Errors
- `500` on unexpected server errors.
- `404` if the path is not found.

---

## GET /congestion

Returns the latest observed object count and a coarse level classification.

Request
- Method: `GET`
- Path: `/congestion`
- Query: none

Response 200
```
{
  "count": 12,                    // integer >= 0, latest objects array length
  "level": "low|mid|high"        // derived from count (see below)
}
```

Level Rules
- `low`  when `count < 10`
- `mid`  when `10 <= count <= 20`
- `high` when `count > 20`

Errors
- `500` on unexpected server errors.
- `404` if the path is not found.

---

## GET /bike

Returns aggregated metrics from HELLO CYCLING GBFS feeds.

Semantics
- `total_available`: number of bikes available at the station nearest to Keio SFC (Shonan Fujisawa Campus).
- `total_returnable`: total number of returnable docks across all stations within 500m of Shonandai Station.

Request
- Method: `GET`
- Path: `/bike`
- Query: none

Response 200
```
{
  "total_available": 7,     // integer >= 0
  "total_returnable": 23    // integer >= 0
}
```

Errors
- `502` when upstream GBFS requests fail or data is malformed.
- `404` if the path is not found.

---

## Quick Start

Run the server:

```
python server.py
```

Optional environment variables:
- `TZ` — timezone name (IANA/Olson), default `Asia/Tokyo`.
- `SFC_STATION_ID` — HELLO CYCLING `station_id` for the SFC campus. Used directly for `total_available`.
- `SHONANDAI_PRIMARY_STATION_IDS` — comma-separated HELLO CYCLING `station_id`s near Shonandai (higher priority group).
- `SHONANDAI_SECONDARY_STATION_IDS` — comma-separated HELLO CYCLING `station_id`s near Shonandai (fallback group).

Behavior
- `total_available` reads bikes from `SFC_STATION_ID`. If unset or unknown, it returns 0.
- `total_returnable` sums docks from `SHONANDAI_PRIMARY_STATION_IDS`. If that sum is 0 and secondary IDs are provided, it falls back to the secondary sum. If neither list is set, it returns 0.

Compatibility
- Also supported: `HELLO_SFC_STATION_ID`, `SHONANDAI_STATION_IDS_PRIMARY`, `SHONANDAI_STATION_IDS_SECONDARY`, and `HELLO_SHONANDAI_STATION_IDS`.

Example requests:

```
curl -s http://localhost:8000/bus | jq .
curl -s http://localhost:8000/congestion | jq .
curl -s http://localhost:8000/timetable | jq .
curl -s http://localhost:8000/bike | jq .
```
