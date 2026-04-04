import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // 30s before refetch
      gcTime: 10 * 60 * 1000,     // 10min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
