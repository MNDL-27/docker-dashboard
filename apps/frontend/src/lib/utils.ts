import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Standard byte formatting with size-appropriate units.
 */
export function formatBytes(bytes: number | null | undefined, fallback = "0 B"): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return fallback;
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Standard percentage formatting.
 */
export function formatPercent(value: number | null | undefined, fallback = "0%"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${value.toFixed(1)}%`;
}
