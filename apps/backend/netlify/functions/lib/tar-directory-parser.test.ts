import { describe, expect, it } from "vitest";

import { buildDirectoryTar, parseTarDirectory } from "./tar-directory-parser.mts";

describe("parseTarDirectory", () => {
  it("parses a basic directory listing", () => {
    const tar = buildDirectoryTar([
      { name: "var/log/app/", type: "directory", mode: 0o755, mtime: 1710494400 },
      { name: "var/log/app.log", type: "file", mode: 0o644, mtime: 1710494400, content: new Uint8Array(12) },
    ]);
    const entries = parseTarDirectory(tar);
    expect(entries).toHaveLength(2);
    const dir = entries.find((e) => e.name === "app");
    const file = entries.find((e) => e.name === "app.log");
    expect(dir?.type).toBe("directory");
    expect(dir?.permissions).toBe("drwxr-xr-x");
    expect(file?.type).toBe("file");
    expect(file?.size).toBe(12);
    expect(file?.permissions).toBe("-rw-r--r--");
  });

  it("sorts directories before files", () => {
    const tar = buildDirectoryTar([
      { name: "zeta.txt", type: "file" },
      { name: "alpha/", type: "directory" },
      { name: "beta.txt", type: "file" },
    ]);
    const entries = parseTarDirectory(tar);
    expect(entries.map((e) => e.name)).toEqual(["alpha", "beta.txt", "zeta.txt"]);
  });

  it("extracts symlink targets", () => {
    const tar = buildDirectoryTar([
      { name: "link", type: "symlink", linkTarget: "/etc/hostname" },
    ]);
    const entries = parseTarDirectory(tar);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("symlink");
    expect(entries[0].linkTarget).toBe("/etc/hostname");
  });

  it("skips . and .. entries", () => {
    const tar = buildDirectoryTar([
      { name: "./", type: "directory" },
      { name: "../", type: "directory" },
      { name: "real.txt", type: "file" },
    ]);
    const entries = parseTarDirectory(tar);
    expect(entries.map((e) => e.name)).toEqual(["real.txt"]);
  });

  it("strips the directory prefix from archive entries", () => {
    const tar = buildDirectoryTar([
      { name: "var/log/sub/", type: "directory" },
      { name: "var/log/sub/inner.txt", type: "file" },
    ]);
    const entries = parseTarDirectory(tar);
    expect(entries.map((e) => e.name)).toEqual(["sub", "inner.txt"]);
  });

  it("handles an empty tar (only end-of-archive blocks)", () => {
    const tar = buildDirectoryTar([]);
    expect(parseTarDirectory(tar)).toEqual([]);
  });

  it("does not execute on shell-metacharacter file names", () => {
    // No shell is invoked; the parser just reads bytes. The path is
    // never eval'd. We assert that a hostile-looking name is treated
    // as a literal string and ends up in the listing.
    const tar = buildDirectoryTar([
      { name: "';id;#.txt", type: "file" },
    ]);
    const entries = parseTarDirectory(tar);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("';id;#.txt");
  });
});
