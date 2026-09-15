import { describe, expect, it } from "vitest";
import { fmtDate, todayPlusDays } from "./date";

describe("fmtDate", () => {
  it("returns date-only strings unchanged", () => {
    expect(fmtDate("2026-09-20")).toBe("2026-09-20");
  });

  it("formats a UTC timestamp using local calendar components", () => {
    const iso = "2026-09-20T12:00:00.000Z";
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    expect(fmtDate(iso)).toBe(expected);
  });

  it("falls back to the input for unparseable values", () => {
    expect(fmtDate("3019-99-99")).toBe("3019-99-99");
    expect(fmtDate("not-a-date")).toBe("not-a-date");
  });
});

describe("todayPlusDays", () => {
  it("returns a YYYY-MM-DD date n days from today", () => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    const expected = fmtDate(d.toISOString());
    expect(todayPlusDays(4)).toBe(expected);
    expect(todayPlusDays(4)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});