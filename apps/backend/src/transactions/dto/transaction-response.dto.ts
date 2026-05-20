import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';

/** Full transaction object returned by all transaction endpoints. `amount` is a fixed-2 decimal string because Prisma Decimal serializes as string. */
export class TransactionResponseDto {
  @ApiProperty({ example: 'cm9abc123def456' })
  id!: string;

  @ApiProperty({ example: '1500.50', description: 'Decimal amount serialized as string' })
  amount!: string;

  @ApiPropertyOptional({ example: 'Lunch at cafe', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  date!: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'], example: 'EXPENSE' })
  type!: string;

  @ApiProperty({ example: 'cm9cat456def789' })
  categoryId!: string;

  @ApiProperty({ type: () => CategoryResponseDto })
  category!: CategoryResponseDto;

  @ApiProperty({ example: 'cm9user789ghi012' })
  userId!: string;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  updatedAt!: string;
}
