import type { UpdateCategoryRequest } from '@expense-tracker/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateCategoryDto implements UpdateCategoryRequest {
  @ApiPropertyOptional({ example: 'Еда', minLength: 1, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ example: '#FF6B6B', description: 'HEX color, e.g. #RRGGBB' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be HEX like #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({ example: '🍔', minLength: 1, maxLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  icon?: string;
}
