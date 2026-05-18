import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type Category, Prisma } from '../generated/prisma/client';
import { CategoriesRepository } from './categories.repository';
import type { UpdateCategoryData } from './categories.repository';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

const DUPLICATE_MESSAGE = 'Category with this name already exists';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  findAll(userId: string): Promise<Category[]> {
    return this.repository.findAllByUser(userId);
  }

  async findOne(id: string, userId: string): Promise<Category> {
    const category = await this.repository.findByIdForUser(id, userId);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

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
