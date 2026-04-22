import { Suspense } from "react";
import { MlsSearchClient } from "./mls-search-client";

export default function MlsSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-text-dim">
          Loading search…
        </div>
      }
    >
      <MlsSearchClient />
    </Suspense>
  );
}
