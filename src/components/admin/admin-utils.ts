export function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function filterByQuery<T extends Record<string, unknown>>(rows: T[], query: string, keys: Array<keyof T>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    keys.some((key) => String(row[key] ?? "").toLowerCase().includes(normalized)),
  );
}
