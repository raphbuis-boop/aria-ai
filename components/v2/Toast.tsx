"use client";

/**
 * Toast primitive — thin wrapper over the existing `sonner` package already
 * installed in this project. Does not re-implement toast logic.
 *
 * Usage:
 *   import { toast } from "@/components/v2/Toast";
 *   toast.success("Saved");
 *   toast.error("Failed");
 */

export { toast } from "sonner";
export type { ExternalToast } from "sonner";
