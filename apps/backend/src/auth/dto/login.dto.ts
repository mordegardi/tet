import type { LoginRequest } from '@expense-tracker/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'strongPassword1' })
  @IsString()
  @MinLength(1)
  password!: string;
}
