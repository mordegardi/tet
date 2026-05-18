'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { ApiError, authApi } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Некорректный email'),
  name: z.string().min(2, 'Минимум 2 символа').max(64),
  password: z.string().min(8, 'Минимум 8 символов').max(128),
  terms: z.boolean().refine((v) => v, { message: 'Необходимо принять соглашение' }),
});
type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const { setSession } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', password: '', terms: false },
  });

  const onSubmit = async ({ terms: _terms, ...registerData }: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await authApi.register(registerData);
      setSession(res);
      toast.success('Регистрация успешна');
      router.replace('/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя</FormLabel>
              <FormControl>
                <Input placeholder="Иван Иванов" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                  id="terms"
                  className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                />
                <label
                  htmlFor="terms"
                  className="text-sm font-normal leading-snug cursor-pointer select-none"
                >
                  Согласен с{' '}
                  <Link href="/terms" className="underline underline-offset-2 hover:text-primary">
                    пользовательским соглашением
                  </Link>{' '}
                  и{' '}
                  <Link href="/privacy" className="underline underline-offset-2 hover:text-primary">
                    политикой обработки данных
                  </Link>
                </label>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
        </Button>
      </form>
    </Form>
  );
}
