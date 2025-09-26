export type DbPayout = {
  withdrawId: string;
  dateCreated: string | null;
  status: string | null;
  statusDetail: string | null;
  amount: number | null;
  fee: number | null;
  payoutDesc: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  identificationType: string | null;
  identificationNumber: string | null;
};

export type DbMovement = {
  id: number;
  timestamp: string;
  description: string | null;
  origin: string | null;
  destination: string | null;
  source_id: string | null;
  direction: "IN" | "OUT" | "NEUTRO";
  amount: number | null;
  payout: DbPayout | null;
};

export type LedgerRow = DbMovement & { runningBalance: number; delta: number };

export type Filters = {
  from: string;
  to: string;
  description: string;
  origin: string;
  destination: string;
  sourceId: string;
  direction: "" | "IN" | "OUT" | "NEUTRO";
  includeAmounts: boolean;
};
