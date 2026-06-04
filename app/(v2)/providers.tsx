"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

/**
 * v2 Provider tree.
 *
 * - QueryClientProvider: React Query for all server state.
 * - Toaster: sonner toast notifications (thin — already used in v1).
 * - Zustand stores are module-level singletons; no provider needed.
 *
 * Do NOT move server data (Supabase rows, API responses) into Zustand.
 */

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't re-fetch on window focus in mobile context — aggressive
        refetchOnWindowFocus: false,
        // 30s stale time — feels snappy without hammering Supabase
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}

// Singleton outside React tree so HMR doesn't recreate it.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new client
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function V2Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1C1D21",
            border: "1px solid #2A2B30",
            color: "#E5E4E2",
          },
        }}
      />
    </QueryClientProvider>
  );
}
