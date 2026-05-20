import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Category, Prisma } from '../generated/prisma/client';
import { CategoriesRepository } from './categories.repository';
import type { UpdateCategoryData } from './categories.repository';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

const DUPLICATE_MESSAGE = 'Category with this name already exists';

/** Business-logic layer for the categories resource. */
@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  /**
   * Returns all categories belonging to `userId`.
   * @returns Promise resolving to an array of {@link Category} records ordered by creation date.
   */
  findAll(userId: string): Promise<Category[]> {
    return this.repository.findAllByUser(userId);
  }

  /**
   * Finds a single category by ID, scoped to `userId`.
   * @returns The {@link Category}.
   * @throws {NotFoundException} When no category with `id` exists for `userId`.
   */
  async findOne(id: string, userId: string): Promise<Category> {
    const category = await this.repository.findByIdForUser(id, userId);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  /**
   * Creates a new category for `userId`.
   * @returns The newly created {@link Category}.
   * @throws {ConflictException} When a category with the same name already exists for `userId` (Prisma P2002).
   */
  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    try {
      return await this.repository.create({ userId, ...dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  /**
   * Updates an existing category.
   * @returns The updated {@link Category}.
   * @throws {NotFoundException} When no category with `id` exists for `userId`.
   * @throws {ConflictException} When renaming would create a duplicate name for `userId` (Prisma P2002).
   */
  async update(id: string, userId: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id, userId);
    const data: UpdateCategoryData = dto;
    try {
      return await this.repository.update(id, data);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  /**
   * Deletes a category owned by `userId`.
   * @returns `void` on success.
   * @throws {NotFoundException} When no category with `id` exists for `userId`.
   * @throws {ConflictException} When the category still has transactions referencing it (Prisma P2003).
   */
  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Cannot delete category with existing transactions');
      }
      throw error;
    }
  }
}
