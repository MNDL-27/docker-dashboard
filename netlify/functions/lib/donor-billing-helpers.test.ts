import { describe, expect, it } from "vitest";

import { coerceString, extractDnr8Token, parseFiniteNumber } from "./donor-billing-helpers.mjs";

describe("donor billing helpers", () => {
  it("extracts DNR-8 token from arbitrary text", () => {
    expect(extractDnr8Token("paid token dnr-ab12cd34 thanks")).toBe("DNR-AB12CD34");
    expect(extractDnr8Token("missing token")).toBeNull();
  });

  it("parses numeric values safely", () => {
    expect(parseFiniteNumber("29.5")).toBe(29.5);
    expect(parseFiniteNumber(10)).toBe(10);
    expect(parseFiniteNumber("abc")).toBeNull();
  });

  it("coerces non-empty strings only", () => {
    expect(coerceString(" hello ")).toBe("hello");
    expect(coerceString("   ")).toBeNull();
    expect(coerceString(3)).toBeNull();
  });
});
