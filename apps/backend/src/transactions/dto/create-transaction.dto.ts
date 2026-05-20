import type { CreateTransactionRequest } from '@expense-tracker/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TransactionType } from '../../generated/prisma/client';

/** DTO for creating a new transaction. Implements the shared {@link CreateTransactionRequest} contract. */
export class CreateTransactionDto implements CreateTransactionRequest {
  @ApiProperty({ example: 1500.5, description: 'Amount, up to 2 decimal places' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'Lunch at cafe', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: 'clxxx...',
    description: 'ID of an existing category belonging to this user',
  })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ enum: Object.values(TransactionType) })
  @IsEnum(TransactionType)
  type!: TransactionType;
}
