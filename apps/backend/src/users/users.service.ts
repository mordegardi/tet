import type { PublicUser } from '@expense-tracker/shared';
import { Injectable } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import type { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  createUser(data: { email: string; name: string; passwordHash: string }): Promise<User> {
    return this.usersRepository.create(data);
  }

  toPublic(user: User): PublicUser {
    return { id: user.id, email: user.email, name: user.name };
  }
}
