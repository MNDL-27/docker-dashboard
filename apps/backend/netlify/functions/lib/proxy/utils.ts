export function sanitizeContainerId(id: string): string {
  const normalized = id.trim();

  if (!/^[a-f0-9]{12,64}$/i.test(normalized)) {
    throw new Error('Invalid container ID format');
  }

  return normalized;
}

export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const exec = async () => {
    while (i < items.length) {
      const index = i++;
      results[index] = await fn(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, exec);
  await Promise.all(workers);
  return results;
}

export function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeOptionalRate(value: unknown): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) {
    return null;
  }
  return numeric;
}

export function normalizeDiskMetric(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const device = typeof value.device === 'string' ? value.device.trim() : '';
  const mount = typeof value.mount === 'string' ? value.mount.trim() : '';
  const usedBytes = toFiniteNumber(value.used_bytes ?? value.usedBytes);
  const totalBytes = toFiniteNumber(value.total_bytes ?? value.totalBytes);
  const readBytesPerSec = normalizeOptionalRate(value.read_bytes_per_sec ?? value.readBytesPerSec);
  const writeBytesPerSec = normalizeOptionalRate(value.write_bytes_per_sec ?? value.writeBytesPerSec);

  if (!device || !mount || usedBytes === null || totalBytes === null || usedBytes < 0 || totalBytes <= 0 || usedBytes > totalBytes) {
    return null;
  }

  return {
    device,
    mount,
    usedBytes,
    totalBytes,
    readBytesPerSec,
    writeBytesPerSec,
  };
}
