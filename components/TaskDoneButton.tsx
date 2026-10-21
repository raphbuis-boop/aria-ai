"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

/** Marks any task done (PATCH /api/tasks/[id]) and refreshes the page. */
export function TaskDoneButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markDone() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      if (!res.ok) throw new Error("Could not update");
      router.refresh();
    } catch {
      toast.error("Could not mark done");
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={markDone} disabled={busy} className="shrink-0">
      <Check className="size-3.5" /> Done
    </Button>
  );
}
