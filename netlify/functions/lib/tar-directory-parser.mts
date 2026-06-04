// POSIX tar header parser used by the container-fs-list proxy path.
// Returns a structured list of directory entries with permissions, sizes,
// modification times, and symlink targets — equivalent to `ls -la` but
// derived from the Docker archive API instead of an `sh -c` exec.

export type TarEntryType = 'file' | 'directory' | 'symlink' | 'other';

export interface TarEntry {
  name: string;
  type: TarEntryType;
  size: number;
  permissions: string;
  modified: string;
  linkTarget?: string;
}

const decoder = new TextDecoder();

function formatUnixMode(type: TarEntryType, mode: number): string {
  if (!Number.isFinite(mode)) {
    return type === 'directory' ? 'd---------' : type === 'symlink' ? 'l---------' : '----------';
  }
  const typeChar =
    type === 'directory' ? 'd' :
    type === 'symlink' ? 'l' :
    type === 'other' ? 'c' : '-';
  const triplet = (shift: number) => {
    const bits = (mode >> shift) & 0o7;
    return (
      (bits & 0o4 ? 'r' : '-') +
      (bits & 0o2 ? 'w' : '-') +
      (bits & 0o1 ? 'x' : '-')
    );
  };
  return `${typeChar}${triplet(6)}${triplet(3)}${triplet(0)}`;
}

function formatMtime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function parseTarDirectory(tarBytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];

  for (let offset = 0; offset + 512 <= tarBytes.length; offset += 512) {
    if (tarBytes[offset] === 0 && tarBytes[offset + 1] === 0 && tarBytes[offset + 2] === 0) {
      break;
    }

    const name = decoder.decode(tarBytes.slice(offset, offset + 100)).replace(/\0/g, '').trim();
    if (!name) continue;

    // Strip the directory prefix and any trailing slash from the archive
    // entry name (e.g. "var/log/sub/" -> "sub", "var/log/sub/inner.txt"
    // -> "inner.txt"). For directory entries, lastIndexOf returns the
    // trailing slash; look at the second-to-last slash instead.
    const trailingSlash = name.endsWith('/');
    const trimmedName = trailingSlash ? name.slice(0, -1) : name;
    const slash = trimmedName.lastIndexOf('/');
    const baseName = slash >= 0 ? trimmedName.slice(slash + 1) : trimmedName;
    if (!baseName || baseName === '.' || baseName === '..') continue;

    const modeOctal = decoder.decode(tarBytes.slice(offset + 100, offset + 108)).replace(/\0/g, '').trim();
    const sizeOctal = decoder.decode(tarBytes.slice(offset + 124, offset + 136)).replace(/\0/g, '').trim();
    const mtimeOctal = decoder.decode(tarBytes.slice(offset + 136, offset + 148)).replace(/\0/g, '').trim();
    const typeFlag = String.fromCharCode(tarBytes[offset + 156]);
    const linkName = decoder.decode(tarBytes.slice(offset + 157, offset + 257)).replace(/\0/g, '').trim();

    const fileSize = parseInt(sizeOctal, 8);
    const fileMode = parseInt(modeOctal, 8);
    const mtimeSec = parseInt(mtimeOctal, 8);

    let fileType: TarEntryType;
    if (typeFlag === '5' || name.endsWith('/')) {
      fileType = 'directory';
    } else if (typeFlag === '2' || typeFlag === 'K' || typeFlag === 'L') {
      fileType = 'symlink';
    } else if (typeFlag === '0' || typeFlag === '\0') {
      fileType = 'file';
    } else {
      fileType = 'other';
    }

    entries.push({
      name: baseName,
      type: fileType,
      size: Number.isFinite(fileSize) ? fileSize : 0,
      permissions: formatUnixMode(fileType, fileMode),
      modified: formatMtime(mtimeSec),
      linkTarget: fileType === 'symlink' ? linkName || undefined : undefined,
    });

    const dataBlocks = Number.isFinite(fileSize) ? Math.ceil(fileSize / 512) : 0;
    offset += dataBlocks * 512;
  }

  entries.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

// Build a minimal POSIX tar block for tests.
function buildTarBlock(name: string, mode: number, size: number, mtime: number, typeFlag: string, linkTarget: string, content?: Uint8Array): Uint8Array {
  const block = new Uint8Array(512);
  const enc = new TextEncoder();
  // Name (100 bytes)
  const nameBytes = enc.encode(name);
  block.set(nameBytes.slice(0, 99), 0);
  // Mode (8 bytes, octal ASCII, null-terminated)
  const modeStr = (mode >>> 0).toString(8).padStart(7, '0') + '\0';
  block.set(enc.encode(modeStr), 100);
  // Size (12 bytes, octal ASCII)
  const sizeStr = (size >>> 0).toString(8).padStart(11, '0') + '\0';
  block.set(enc.encode(sizeStr), 124);
  // Mtime (12 bytes, octal ASCII)
  const mtimeStr = (mtime >>> 0).toString(8).padStart(11, '0') + '\0';
  block.set(enc.encode(mtimeStr), 136);
  // Typeflag (1 byte)
  block[156] = typeFlag.charCodeAt(0);
  // Link name (100 bytes)
  if (linkTarget) {
    const linkBytes = enc.encode(linkTarget);
    block.set(linkBytes.slice(0, 99), 157);
  }
  // Compute checksum (treat bytes as spaces, then sum).
  for (let i = 0; i < 512; i++) {
    if (i >= 148 && i < 156) {
      block[i] = 0x20; // space
    } else {
      block[i] = block[i];
    }
  }
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += block[i];
  const chk = sum.toString(8).padStart(6, '0') + '\0 ';
  block.set(enc.encode(chk), 148);

  if (content && content.length > 0) {
    const full = new Uint8Array(512 * (1 + Math.ceil(content.length / 512)));
    full.set(block, 0);
    full.set(content, 512);
    return full;
  }
  return block;
}

export function buildDirectoryTar(entries: Array<{ name: string; type: TarEntryType; size?: number; mode?: number; mtime?: number; linkTarget?: string; content?: Uint8Array }>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const e of entries) {
    const mode = e.mode ?? (e.type === 'directory' ? 0o755 : 0o644);
    const size = e.size ?? e.content?.length ?? 0;
    const mtime = e.mtime ?? 0;
    const typeFlag = e.type === 'directory' ? '5' : e.type === 'symlink' ? '2' : '0';
    blocks.push(buildTarBlock(e.name, mode, size, mtime, typeFlag, e.linkTarget ?? '', e.content));
  }
  // End-of-archive: two zero blocks.
  blocks.push(new Uint8Array(512));
  blocks.push(new Uint8Array(512));
  const total = blocks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of blocks) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}
