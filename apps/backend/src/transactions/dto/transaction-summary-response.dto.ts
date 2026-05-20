import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Aggregated income/expense summary returned by `GET /transactions/summary`. Monetary values are fixed-2 decimal strings. */
export class TransactionSummaryResponseDto {
  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description: 'Month (1–12), or null for a full-year summary',
  })
  month!: number | null;

  @ApiProperty({ example: '5000.00', description: 'Total income for the period' })
  totalIncome!: string;

  @ApiProperty({ example: '3200.50', description: 'Total expense for the period' })
  totalExpense!: string;

  @ApiProperty({ example: '1799.50', description: 'Balance = totalIncome − totalExpense' })
  balance!: string;

  @ApiProperty({ example: 12 })
  transactionCount!: number;
}
