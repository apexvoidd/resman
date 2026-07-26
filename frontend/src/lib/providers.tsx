"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { queryClient as defaultQueryClient } from "@/lib/query-client";
import { ToastProvider } from "@/context/ToastContext";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => defaultQueryClient);

  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
