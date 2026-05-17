import { TransactionList } from '@/components/transaction-list';

export default function DashboardPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Последние транзакции</h1>
      <TransactionList />
    </div>
  );
}
