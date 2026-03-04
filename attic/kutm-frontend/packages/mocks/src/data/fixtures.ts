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

const initialState: FixtureState = {
  customer: {
    id: "c1",
    name: "Alex Customer",
    phone: "+13125551212",
    email: "alex@example.com"
  },
  customerEtag: '"c_etag_v1"',
  conflictOnce: true
};

let state: FixtureState = structuredClone(initialState);

export function getFixtures() {
  return state;
}

export function setCustomer(next: CustomerFixture, etag: string) {
  state.customer = next;
  state.customerEtag = etag;
}

export function consumeConflictOnce() {
  const hadConflict = state.conflictOnce;
  state.conflictOnce = false;
  return hadConflict;
}

export function resetFixtures() {
  state = structuredClone(initialState);
}
