import type { PublicUser } from '@expense-tracker/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HttpErrorDto, ValidationErrorDto } from '../common/dto/http-error.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransactionSummaryQueryDto } from './dto/transaction-summary-query.dto';
import { TransactionSummaryResponseDto } from './dto/transaction-summary-response.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

/** HTTP controller for the `/transactions` resource. All routes require a valid JWT (via {@link JwtAuthGuard}). */
@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  /**
   * Lists all transactions that belong to the authenticated user.
   * @returns Array of transactions ordered by date descending, each including the related category.
   * @throws {UnauthorizedException} When the JWT is missing or invalid (HTTP 401).
   */
  @Get()
  @ApiOperation({ summary: 'List all transactions for the current user' })
  @ApiResponse({ status: 200, description: 'List of transactions', type: [TransactionResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: HttpErrorDto })
  findAll(@CurrentUser() user: PublicUser) {
    return this.transactions.findAll(user.id);
  }

  /**
   * Returns an aggregated income/expense summary for the given year, or a specific month within that year.
   * @returns `{ year, month, totalIncome, totalExpense, balance, transactionCount }` with monetary values as fixed-2 decimal strings.
   * @throws {UnauthorizedException} When the JWT is missing or invalid (HTTP 401).
   * @throws {BadRequestException} When query parameters fail validation (HTTP 400).
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Get income/expense summary for a year or month',
    description:
      'Returns totals and balance for the given `year`. Pass `month` (1–12) to narrow the period to a single month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary with totals and balance',
    type: TransactionSummaryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters', type: ValidationErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: HttpErrorDto })
  summary(@Query() query: TransactionSummaryQueryDto, @CurrentUser() user: PublicUser) {
    return this.transactions.summary(user.id, query);
  }

  /**
   * Retrieves a single transaction by its ID.
   * @returns The transaction with its category included.
   * @throws {UnauthorizedException} When the JWT is missing or invalid (HTTP 401).
   * @throws {NotFoundException} When no transaction with `id` exists for the current user (HTTP 404).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction CUID', example: 'cm9abc123def456ghi' })
  @ApiResponse({ status: 200, description: 'Transaction found', type: TransactionResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: HttpErrorDto })
  @ApiResponse({ status: 404, description: 'Transaction not found', type: HttpErrorDto })
  findOne(@Param('id') id: string, @CurrentUser() user: PublicUser) {
    return this.transactions.findOne(id, user.id);
  }

  /**
   * Creates a new transaction for the authenticated user.
   * @returns The newly created transaction with its category included (HTTP 201).
   * @throws {UnauthorizedException} When the JWT is missing or invalid (HTTP 401).
   * @throws {BadRequestException} When the request body fails validation (HTTP 400).
   * @throws {NotFoundException} When `categoryId` does not exist or does not belong to the user (HTTP 404).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error', type: ValidationErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: HttpErrorDto })
  @ApiResponse({
    status: 404,
    description: 'Category not found or does not belong to user',
    type: HttpErrorDto,
  })
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: PublicUser) {
    return this.transactions.create(user.id, dto);
  }

  /**
   * Updates an existing transaction. Only provided fields are changed.
   * @returns The updated transaction with its category included.
   * @throws {UnauthorizedException} When the JWT is missing or invalid (HTTP 401).
   * @throws {BadRequestException} When the request body fails validation (HTTP 400).
   * @throws {NotFoundException} When the transaction does not exist for the user, or when a new `categoryId` is not found (HTTP 404).
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a transaction',
    description: 'Partial update — only the provided fields are changed.',
  })
  @ApiParam({ name: 'id', description: 'Transaction CUID', example: 'cm9abc123def456ghi' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({ status: 200, description: 'Transaction updated', type: TransactionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error', type: ValidationErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: HttpErrorDto })
  @ApiResponse({
    status: 404,
    description: 'Transaction or category not found',
    type: HttpErrorDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: PublicUser,
  ) {
    return this.transactions.update(id, user.id, dto);
  }

  /**
   * Deletes a transaction owned by the authenticated user.
   * @returns `void` (HTTP 204 No Content).
   * @throws {UnauthorizedException} When the JWT is missing or invalid (HTTP 401).
   * @throws {NotFoundException} When no transaction with `id` exists for the current user (HTTP 404).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction CUID', example: 'cm9abc123def456ghi' })
  @ApiResponse({ status: 204, description: 'Transaction deleted — no response body' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: HttpErrorDto })
  @ApiResponse({ status: 404, description: 'Transaction not found', type: HttpErrorDto })
  remove(@Param('id') id: string, @CurrentUser() user: PublicUser): Promise<void> {
    return this.transactions.remove(id, user.id);
  }
}
