import { Injectable } from '@nestjs/common';
import type { Category } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCategoryData {
  userId: string;
  name: string;
  color: string;
  icon: string;
}

export type UpdateCategoryData = Partial<Omit<CreateCategoryData, 'userId'>>;

/** Data-access layer for the categories resource. All queries are scoped to a specific user. */
@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all categories belonging to `userId`, ordered by creation date ascending.
   * @returns Promise resolving to an array of {@link Category} records.
   */
  findAllByUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finds a single category by `id` scoped to `userId`.
   * @returns The {@link Category}, or `null` if not found.
   */
  findByIdForUser(id: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, userId } });
  }

  /**
   * Inserts a new category row.
   * @returns The created {@link Category}.
   */
  create(data: CreateCategoryData): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  /**
   * Updates the category with `id` using the provided fields.
   * @returns The updated {@link Category}.
   */
  update(id: string, data: UpdateCategoryData): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  /**
   * Deletes the category with `id`.
   * @returns `void` on success.
   */
  delete(id: string): Promise<void> {
    return this.prisma.category.delete({ where: { id } }).then(() => undefined);
  }
}
