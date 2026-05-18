import type { PublicUser } from '@expense-tracker/shared';
import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as PublicUser;
  },
);
