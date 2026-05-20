import { ApiProperty } from '@nestjs/swagger';

/** Shape of the category object nested inside transaction responses. */
export class CategoryResponseDto {
  @ApiProperty({ example: 'cm9cat456def789' })
  id!: string;

  @ApiProperty({ example: 'Food' })
  name!: string;

  @ApiProperty({ example: '#FF6B6B', description: 'HEX color' })
  color!: string;

  @ApiProperty({ example: '🍔' })
  icon!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}
