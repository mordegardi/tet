import type { RegisterRequest } from '@expense-tracker/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Alice', minLength: 2, maxLength: 64 })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: 'strongPassword1', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
