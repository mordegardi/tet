import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * NestJS wrapper around {@link PrismaClient} that manages the database connection lifecycle.
 * Inject this service wherever database access is needed — never instantiate `PrismaClient` directly.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  /**
   * Opens the database connection when the NestJS module initialises.
   * @returns Promise that resolves once the connection is established.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Closes the database connection when the NestJS module is destroyed (e.g. on graceful shutdown).
   * @returns Promise that resolves once the connection is closed.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
