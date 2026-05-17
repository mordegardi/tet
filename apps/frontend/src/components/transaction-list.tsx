'use client';

import { ApiError, transactionsApi } from '@/lib/api';
import type { Transaction } from '@expense-tracker/shared';
import { useEffect, useState } from 'react';

function formatAmount(amount: string, type: string): string {
  const num = Number.parseFloat(amount);
  const sign = type === 'INCOME' ? '+' : '-';
  return `${sign}${Math.abs(num).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    transactionsApi
      .getAll()
      .then((data) => setTransactions(data.slice(0, 10)))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Ошибка загрузки транзакций');
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <p className="text-sm text-gray-500">Загрузка...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (transactions.length === 0)
    return <p className="text-sm text-gray-500">Транзакций пока нет.</p>;

  return (
    <ul className="divide-y rounded-lg border bg-white">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{t.category.icon}</span>
            <div>
              <p className="text-sm font-medium">{t.category.name}</p>
              {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
            </div>
          </div>
          <div className="text-right">
            <p
              className={`text-sm font-semibold ${
                t.category.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatAmount(t.amount, t.category.type)}
            </p>
            <p className="text-xs text-gray-400">{formatDate(t.date)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
