import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDayType, nextBuses, nextAcrossAll, shapeItem } from "../nextbus.js";

describe("nextbus utilities", () => {
  const FIXED = new Date("2025-09-08T17:59:00+09:00"); // Monday -> weekday

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("getDayType returns weekday/saturday/holiday correctly", () => {
    expect(getDayType(new Date("2025-09-08T12:00:00+09:00"))).toBe("weekday"); // Mon
    expect(getDayType(new Date("2025-09-06T12:00:00+09:00"))).toBe("saturday"); // Sat
    expect(getDayType(new Date("2025-09-07T12:00:00+09:00"))).toBe("holiday"); // Sun
  });

  it("nextBuses returns next 5 for 湘25 on weekday from 17:59", () => {
    const res = nextBuses("湘25", new Date(), 5);
    const times = res.map(r => r.datetime.toTimeString().slice(0,5));
    expect(times.slice(0,5)).toEqual(["18:01","18:09","18:16","18:23","18:30"]);
    expect(res.every(r => r.line === "湘25")).toBe(true);
    expect(res.every(r => r.dayType === "weekday")).toBe(true);
  });

  it("nextAcrossAll merges/sorts across lines", () => {
    const res = nextAcrossAll(new Date(), 5);
    expect(res.length).toBe(5);
    for (let i = 1; i < res.length; i++) {
      expect(res[i].datetime >= res[i-1].datetime).toBe(true);
    }
    expect(res[0]).toHaveProperty("line");
    expect(res[0]).toHaveProperty("dayType");
  });

  it("shapeItem adds display fields and minutesUntil >= 0", () => {
    const item = nextBuses("湘28", new Date("2025-09-08T22:00:00+09:00"), 1)[0];
    const shaped = shapeItem(new Date("2025-09-08T22:00:00+09:00"), item, "Asia/Tokyo");
    expect(shaped).toHaveProperty("line", "湘28");
    expect(shaped).toHaveProperty("time");
    expect(shaped).toHaveProperty("minutesUntil");
    expect(typeof shaped.minutesUntil).toBe("number");
    expect(shaped.minutesUntil).toBeGreaterThan(0);
  });
});
