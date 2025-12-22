import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Senior, InsertSenior } from "@shared/schema";

export function useSeniors() {
  return useQuery({
    queryKey: [api.seniors.list.path],
    queryFn: async () => {
      const res = await fetch(api.seniors.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch seniors");
      return api.seniors.list.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateSenior() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertSenior>) => {
      const url = buildUrl(api.seniors.update.path, { id });
      const res = await fetch(url, {
        method: api.seniors.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update senior");
      return api.seniors.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.seniors.list.path] });
    },
  });
}
