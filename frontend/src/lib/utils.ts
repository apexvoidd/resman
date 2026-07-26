import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSafeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1"))
  ) {
    return null;
  }
  return url;
}
