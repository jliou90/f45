import { kutmApi } from "../../lib/kutm";

export type AccountingPeriod = {
  id: string;
  status?: string | null;
  year?: number | null;
  month?: number | null;
};

type PeriodPage = {
  items: AccountingPeriod[];
};

export async function listAccountingPeriods(): Promise<AccountingPeriod[]> {
  const response = await kutmApi.get<PeriodPage>("/acct/periods", { page: 1, size: 100 }, true);
  return response.items ?? [];
}

export async function getAccountingPeriod(periodId: string): Promise<AccountingPeriod | null> {
  const rows = await listAccountingPeriods();
  return rows.find((row) => row.id === periodId) ?? null;
}
