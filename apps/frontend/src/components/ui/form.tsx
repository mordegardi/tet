'use client';

import * as React from 'react';
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
} from 'react-hook-form';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldContext.name, formState);
  return { name: fieldContext.name, ...fieldState };
}

const FormItemContext = React.createContext<{ id: string }>({ id: '' });

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('flex flex-col gap-1.5', className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({ className, ...props }: React.ComponentProps<'label'>) {
  const { error } = useFormField();
  const { id } = React.useContext(FormItemContext);
  return <Label htmlFor={id} className={cn(error && 'text-destructive', className)} {...props} />;
}

function FormControl({ children }: { children: React.ReactNode }) {
  const { error } = useFormField();
  const { id } = React.useContext(FormItemContext);
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      id,
      'aria-invalid': !!error || undefined,
    });
  }
  return <>{children}</>;
}

function FormMessage({ className, children, ...props }: React.ComponentProps<'p'>) {
  const { error } = useFormField();
  const body = error ? String(error.message) : children;
  if (!body) return null;
  return (
    <p className={cn('text-sm text-destructive', className)} {...props}>
      {body}
    </p>
  );
}

export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, useFormField };
