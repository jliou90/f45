import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";

export type MeResponse = {
  user: { id: string; name: string };
  tenants: Array<{ id: string; name: string }>;
  defaultApps: string[];
  permissions: string[];
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const resp = await apiClient.request<MeResponse>({ method: "GET", path: "/me" });
      return resp.data;
    }
  });
}
