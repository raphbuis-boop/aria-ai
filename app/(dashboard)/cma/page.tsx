import { Suspense } from "react";
import { CmaInner } from "./cma-inner";

export default function CmaPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-[13px] text-text-dim">Loading…</div>
      }
    >
      <CmaInner />
    </Suspense>
  );
}
