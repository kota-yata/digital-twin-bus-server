import { TIMETABLE } from "./timetable.js";

export function getDayType(d = new Date()) {
  const wd = d.getDay(); // 0=Sun ... 6=Sat
  if (wd === 0) return "holiday";
  if (wd === 6) return "saturday";
  return "weekday";
}

function expandDayDepartures(lineName, baseDate, dayType) {
  const table = TIMETABLE[lineName]?.[dayType] || {};
  const list = [];
  for (let h = 0; h <= 24; h++) {
    const mins = table[h];
    if (!mins) continue;
    for (const m of mins) {
      const dt = new Date(baseDate);
      dt.setHours(h, m, 0, 0);
      list.push(dt);
    }
  }
  return list.sort((a, b) => a - b);
}

export function nextBuses(lineName, fromDate = new Date(), count = 5) {
  if (!TIMETABLE[lineName]) throw new Error(`未知の系統: ${lineName}`);
  const results = [];
  let probe = new Date(fromDate);
  for (let dayOffset = 0; dayOffset < 7 && results.length < count; dayOffset++) {
    const dayStart = new Date(probe);
    dayStart.setHours(0, 0, 0, 0);
    const dayType = getDayType(probe);
    const departures = expandDayDepartures(lineName, dayStart, dayType);
    const filtered = departures.filter(dt => dayOffset > 0 || dt >= fromDate);
    for (const dt of filtered) {
      results.push({ line: lineName, dayType, datetime: dt });
      if (results.length >= count) break;
    }
    probe.setDate(probe.getDate() + 1);
    probe.setHours(0, 0, 0, 0);
  }
  return results;
}

export function nextAcrossAll(fromDate = new Date(), count = 5) {
  const lines = Object.keys(TIMETABLE);
  const bucket = [];
  let probe = new Date(fromDate);
  for (let dayOffset = 0; dayOffset < 7 && bucket.length < count; dayOffset++) {
    const dayStart = new Date(probe);
    dayStart.setHours(0, 0, 0, 0);
    for (const line of lines) {
      const dayType = getDayType(probe);
      const dep = expandDayDepartures(line, dayStart, dayType);
      const filtered = dep.filter(dt => dayOffset > 0 || dt >= fromDate);
      for (const dt of filtered) bucket.push({ line, dayType, datetime: dt });
    }
    probe.setDate(probe.getDate() + 1);
    probe.setHours(0, 0, 0, 0);
  }
  bucket.sort((a, b) => a.datetime - b.datetime);
  return bucket.slice(0, count);
}

export function shapeItem(now, item, tz = "Asia/Tokyo") {
  const mins = Math.max(0, Math.round((item.datetime - now) / 60000));
  const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: tz, hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" });
  const time = new Intl.DateTimeFormat("ja-JP", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(item.datetime);
  return {
    line: item.line,
    dayType: item.dayType,
    iso: item.datetime.toISOString(),
    local: fmt.format(item.datetime),
    time,
    minutesUntil: mins
  };
}
