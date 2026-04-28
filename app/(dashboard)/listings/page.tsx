import { Suspense } from "react";
import { MlsSearchClient } from "../mls/mls-search-client";

export default function ListingsSearchPage() {
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
