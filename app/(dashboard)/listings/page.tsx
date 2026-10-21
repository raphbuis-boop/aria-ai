import { Suspense } from "react";
import { MlsSearchClient } from "./mls-search-client";
import { isSimplyRetsConfigured, njmlsSearchUrl } from "@/lib/simplyrets";

export const dynamic = "force-dynamic";

export default function ListingsSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-muted-foreground">
          Loading search…
        </div>
      }
    >
      <MlsSearchClient mlsConfigured={isSimplyRetsConfigured()} njmlsSearchUrl={njmlsSearchUrl()} />
    </Suspense>
  );
}
