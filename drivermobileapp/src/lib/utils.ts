import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatCurrency(amount: number, currency: string = "USD") {
  const currencyCode = currency === "ZAR" ? "ZAR" : "USD";
  const locale = currencyCode === "USD" ? "en-US" : "en-ZA";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat("en-ZA").format(num);
}