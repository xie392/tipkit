import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 tailwind 类名（shadcn 惯例） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
