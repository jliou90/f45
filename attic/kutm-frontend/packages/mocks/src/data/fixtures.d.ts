export type CustomerFixture = {
    id: string;
    name: string;
    phone: string;
    email: string;
};
type FixtureState = {
    customer: CustomerFixture;
    customerEtag: string;
    conflictOnce: boolean;
};
export declare function getFixtures(): FixtureState;
export declare function setCustomer(next: CustomerFixture, etag: string): void;
export declare function consumeConflictOnce(): boolean;
export declare function resetFixtures(): void;
export {};
