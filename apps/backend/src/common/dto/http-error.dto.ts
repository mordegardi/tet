import { ApiProperty } from '@nestjs/swagger';

/** Represents a standard NestJS HTTP error response body (401, 404, 409, etc.). */
export class HttpErrorDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'Transaction not found' })
  message!: string;

  @ApiProperty({ example: 'Not Found' })
  error!: string;
}

/** Represents a validation error response body (HTTP 400) where `message` is an array of constraint violations. */
export class ValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    example: ['amount must not be less than 0.01', 'type must be a valid enum value'],
    type: [String],
  })
  message!: string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}
