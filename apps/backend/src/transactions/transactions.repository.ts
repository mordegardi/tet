import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateTransactionData {
  userId: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: string;
  type: TransactionType;
}

type UpdateTransactionData = Partial<Omit<CreateTransactionData, 'userId'>>;

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
    });
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  }

  create(data: CreateTransactionData) {
    return this.prisma.transaction.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        amount: data.amount,
        description: data.description,
        date: new Date(data.date),
        type: data.type,
      },
      include: { category: true },
    });
  }

  update(id: string, data: UpdateTransactionData) {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.type !== undefined && { type: data.type }),
      },
      include: { category: true },
    });
  }

  delete(id: string): Promise<void> {
    return this.prisma.transaction.delete({ where: { id } }).then(() => undefined);
  }

  async aggregateByType(userId: string, gte: Date, lt: Date) {
    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, date: { gte, lt }, type: 'INCOME' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, date: { gte, lt }, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);
    return {
      income: { sum: income._sum.amount ?? new Prisma.Decimal(0), count: income._count.id },
      expense: { sum: expense._sum.amount ?? new Prisma.Decimal(0), count: expense._count.id },
    };
  }
}
