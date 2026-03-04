export type MeResponse = {
    user: {
        id: string;
        name: string;
    };
    tenants: Array<{
        id: string;
        name: string;
    }>;
    defaultApps: string[];
    permissions: string[];
};
export declare function useMe(): import("@tanstack/react-query").UseQueryResult<MeResponse, Error>;
