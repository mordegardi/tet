import type { Category } from './categories';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  amount: string; // Decimal serializes as string
  description: string | null;
  date: string; // ISO datetime
  type: TransactionType;
  categoryId: string;
  category: Category; // always included (Prisma include)
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  amount: number; // frontend sends number
  description?: string;
  date: string; // ISO datetime
  categoryId: string;
  type: TransactionType;
}

export type UpdateTransactionRequest = Partial<CreateTransactionRequest>;

export interface TransactionSummary {
  year: number;
  month: number | null;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  transactionCount: number;
}
