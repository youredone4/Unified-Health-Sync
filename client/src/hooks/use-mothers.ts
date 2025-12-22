import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Mother, InsertMother } from "@shared/schema";

export function useMothers() {
  return useQuery({
    queryKey: [api.mothers.list.path],
    queryFn: async () => {
      const res = await fetch(api.mothers.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch mothers");
      return api.mothers.list.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateMother() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertMother>) => {
      const url = buildUrl(api.mothers.update.path, { id });
      const res = await fetch(url, {
        method: api.mothers.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update mother");
      return api.mothers.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.mothers.list.path] });
    },
  });
}
