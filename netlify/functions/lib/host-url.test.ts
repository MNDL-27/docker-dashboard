import { describe, expect, it } from "vitest";

import { normalizeAndValidateHostUrl } from "./host-url.mts";

describe("host-url IPv6 / SSRF guards", () => {
  it("rejects IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[::ffff:127.0.0.1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv4-mapped IPv6 link-local (::ffff:169.254.169.254)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[::ffff:169.254.169.254]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv4-mapped IPv6 RFC1918 (::ffff:10.0.0.1)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[::ffff:10.0.0.1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects deprecated site-local IPv6 (fec0::1)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[fec0::1]/")).toThrow(/private|loop-local|unique-local/);
  });

  it("rejects IPv6 documentation prefix (2001:db8::1)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[2001:db8::1]/")).toThrow();
  });

  it("rejects IPv6 discard prefix (100::1)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[100::1]/")).toThrow();
  });

it("rejects IPv6 multicast ff00::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff00::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff01::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff01::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff02::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff02::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff03::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff03::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff04::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff04::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff05::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff05::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff06::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff06::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff07::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff07::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff08::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff08::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff09::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff09::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff0a::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff0a::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff0b::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff0b::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff0c::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff0c::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff0d::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff0d::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff0e::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff0e::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 multicast ff0f::/8", () => {
    expect(() => normalizeAndValidateHostUrl("https://[ff0f::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("rejects IPv6 unspecified (::)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[::]/")).toThrow();
  });

  it("rejects IPv4-IPv6 translation prefix (64:ff9b::1)", () => {
    expect(() => normalizeAndValidateHostUrl("https://[64:ff9b::1]/")).toThrow();
  });

  it("still rejects link-local fe80::", () => {
    expect(() => normalizeAndValidateHostUrl("https://[fe80::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("still rejects unique-local fc00::/7", () => {
    expect(() => normalizeAndValidateHostUrl("https://[fc00::1]/")).toThrow(/private|loopback|link-local/);
  });

  it("accepts public IPv6 addresses", () => {
    expect(normalizeAndValidateHostUrl("https://[2606:4700:4700::1111]/")).toBe("https://[2606:4700:4700::1111]");
  });

  it("rejects http on public IPs (must be https)", () => {
    expect(() => normalizeAndValidateHostUrl("http://8.8.8.8/")).toThrow(/https/);
  });
});

describe("host-url ALLOW_LOCAL_AGENT_URLS production guard", () => {
  it("rejects local hostnames in production even when flag is true", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_LOCAL_AGENT_URLS = "true";
      expect(() => normalizeAndValidateHostUrl("http://localhost:8080/")).toThrow();
      expect(() => normalizeAndValidateHostUrl("https://localhost:8080/")).toThrow(/localhost/);
      expect(() => normalizeAndValidateHostUrl("https://127.0.0.1:9000/")).toThrow(/localhost/);
    } finally {
      process.env = originalEnv;
    }
  });
});

describe("host-url local agent URL guard", () => {
  it("rejects local hostnames in production", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = "production";
      expect(() => normalizeAndValidateHostUrl("http://localhost:8080/")).toThrow();
      expect(() => normalizeAndValidateHostUrl("https://localhost:8080/")).toThrow(/localhost/);
      expect(() => normalizeAndValidateHostUrl("https://127.0.0.1:9000/")).toThrow(/localhost/);
    } finally {
      process.env = originalEnv;
    }
  });

  it("allows local hostnames in non-production environments", () => {
    const originalEnv = { ...process.env };
    try {
      process.env.NODE_ENV = "development";
      expect(() => normalizeAndValidateHostUrl("http://localhost:8080/")).not.toThrow();
      expect(() => normalizeAndValidateHostUrl("https://localhost:8080/")).not.toThrow();
      expect(() => normalizeAndValidateHostUrl("https://127.0.0.1:9000/")).not.toThrow();
    } finally {
      process.env = originalEnv;
    }
  });
});
