import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that validates the `Authorization: Bearer <token>` header using the `jwt` Passport strategy.
 * @throws {UnauthorizedException} When the token is missing, expired, or invalid (HTTP 401).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
