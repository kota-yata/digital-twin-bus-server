import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { app } from "../server.js";

describe("GET /bus", () => {
  const FIXED = new Date("2025-09-08T17:59:00+09:00");

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns 5 upcoming buses across all lines with metadata", async () => {
    const res = await request(app).get("/bus").expect(200);
    expect(res.body).toHaveProperty("from");
    expect(res.body).toHaveProperty("count", 5);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(5);

    for (const it of res.body.items) {
      expect(it).toHaveProperty("line");
      expect(it).toHaveProperty("dayType");
      expect(it).toHaveProperty("iso");
      expect(it).toHaveProperty("local");
      expect(it).toHaveProperty("time");
      expect(it).toHaveProperty("minutesUntil");
      expect(typeof it.minutesUntil).toBe("number");
    }

    const t = res.body.items.map(i => i.iso);
    const sorted = [...t].sort();
    expect(t).toEqual(sorted);
  });
});
