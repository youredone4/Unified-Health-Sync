import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Child, InsertChild } from "@shared/schema";

export function useChildren() {
  return useQuery({
    queryKey: [api.children.list.path],
    queryFn: async () => {
      const res = await fetch(api.children.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch children");
      return api.children.list.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertChild>) => {
      const url = buildUrl(api.children.update.path, { id });
      const res = await fetch(url, {
        method: api.children.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update child");
      return api.children.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.children.list.path] });
    },
  });
}
