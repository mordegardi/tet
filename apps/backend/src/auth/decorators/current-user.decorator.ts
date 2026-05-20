import type { PublicUser } from '@expense-tracker/shared';
import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * Route-parameter decorator that extracts the authenticated user from `req.user` as {@link PublicUser}.
 * Only works on routes protected by {@link JwtAuthGuard}.
 * @returns The {@link PublicUser} placed on the request by `JwtStrategy.validate`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as PublicUser;
  },
);
