let resolver = async () => ({ resolution: "cancel" });
export function registerConflictResolver(next) {
    resolver = next;
}
export async function resolveConflict(payload) {
    const result = await resolver(payload);
    return result ?? { resolution: "cancel" };
}
