import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ModalProvider } from "@kutm/ui-platform";
import { AuthProvider } from "../features/auth/authStore";
import { registerConflictResolver } from "@kutm/core";
import { openModal } from "@kutm/ui-platform";

const queryClient = new QueryClient();

registerConflictResolver(async (payload) => {
  return openModal("platform.conflict", payload);
});

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ModalProvider>{children}</ModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
