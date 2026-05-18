import type { CreateCategoryRequest } from '@expense-tracker/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto implements CreateCategoryRequest {
  @ApiProperty({ example: 'Еда', minLength: 1, maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: '#FF6B6B', description: 'HEX color, e.g. #RRGGBB' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be HEX like #RRGGBB' })
  color!: string;

  @ApiProperty({ example: '🍔', minLength: 1, maxLength: 8 })
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  icon!: string;
}
