import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useHealthStations() {
  return useQuery({
    queryKey: [api.healthStations.list.path],
    queryFn: async () => {
      const res = await fetch(api.healthStations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch health stations");
      return api.healthStations.list.responses[200].parse(await res.json());
    },
  });
}
