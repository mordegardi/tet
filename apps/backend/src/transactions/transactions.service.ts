import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../categories/categories.repository';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { TransactionSummaryQueryDto } from './dto/transaction-summary-query.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsRepository } from './transactions.repository';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  findAll(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.repository.findByIdForUser(id, userId);
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const category = await this.categoriesRepository.findByIdForUser(dto.categoryId, userId);
    if (!category) throw new NotFoundException('Category not found');
    return this.repository.create({ userId, ...dto });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    await this.findOne(id, userId);
    if (dto.categoryId !== undefined) {
      const category = await this.categoriesRepository.findByIdForUser(dto.categoryId, userId);
      if (!category) throw new NotFoundException('Category not found');
    }
    return this.repository.update(id, dto);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.repository.delete(id);
  }

  async summary(userId: string, query: TransactionSummaryQueryDto) {
    const { year, month } = query;
    let gte: Date;
    let lt: Date;
    if (month !== undefined) {
      gte = new Date(Date.UTC(year, month - 1, 1));
      lt = new Date(Date.UTC(year, month, 1));
    } else {
      gte = new Date(Date.UTC(year, 0, 1));
      lt = new Date(Date.UTC(year + 1, 0, 1));
    }
    const result = await this.repository.aggregateByType(userId, gte, lt);
    const balance = result.income.sum.minus(result.expense.sum);
    return {
      year,
      month: month ?? null,
      totalIncome: result.income.sum.toFixed(2),
      totalExpense: result.expense.sum.toFixed(2),
      balance: balance.toFixed(2),
      transactionCount: result.income.count + result.expense.count,
    };
  }
}
