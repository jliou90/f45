import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
export function useMe() {
    return useQuery({
        queryKey: ["me"],
        queryFn: async () => {
            const resp = await apiClient.request({ method: "GET", path: "/me" });
            return resp.data;
        }
    });
}
