import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../categories/categories.repository';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { TransactionSummaryQueryDto } from './dto/transaction-summary-query.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsRepository } from './transactions.repository';

/** Business-logic layer for the transactions resource. */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  /**
   * Returns all transactions belonging to `userId`, ordered by date descending.
   * @returns Promise resolving to an array of transactions with their category included.
   */
  findAll(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  /**
   * Finds a single transaction by ID, scoped to `userId`.
   * @returns The transaction with its category included.
   * @throws {NotFoundException} When no transaction with `id` exists for `userId`.
   */
  async findOne(id: string, userId: string) {
    const transaction = await this.repository.findByIdForUser(id, userId);
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  /**
   * Creates a new transaction for `userId`.
   * @returns The newly created transaction with its category included.
   * @throws {NotFoundException} When `dto.categoryId` does not exist or does not belong to `userId`.
   */
  async create(userId: string, dto: CreateTransactionDto) {
    const category = await this.categoriesRepository.findByIdForUser(dto.categoryId, userId);
    if (!category) throw new NotFoundException('Category not found');
    return this.repository.create({ userId, ...dto });
  }

  /**
   * Updates an existing transaction.
   * @returns The updated transaction with its category included.
   * @throws {NotFoundException} When the transaction does not exist for `userId`, or when `dto.categoryId` is provided but does not belong to `userId`.
   */
  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    await this.findOne(id, userId);
    if (dto.categoryId !== undefined) {
      const category = await this.categoriesRepository.findByIdForUser(dto.categoryId, userId);
      if (!category) throw new NotFoundException('Category not found');
    }
    return this.repository.update(id, dto);
  }

  /**
   * Deletes a transaction.
   * @returns `void` on success.
   * @throws {NotFoundException} When the transaction does not exist for `userId`.
   */
  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.repository.delete(id);
  }

  /**
   * Computes an income/expense summary for a given year or year+month.
   * @returns An object with `totalIncome`, `totalExpense`, `balance` (as fixed-2 decimal strings) and `transactionCount`.
   */
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
