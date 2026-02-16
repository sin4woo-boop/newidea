import { ButtonHTMLAttributes, DetailedHTMLProps, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card(props: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
  return <div {...props} className={cn('rounded-xl border border-border bg-card p-4 shadow-none', props.className)} />;
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' }) {
  const { variant = 'default', className, ...rest } = props;
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'default'
          ? 'bg-primary text-primary-foreground hover:bg-[#A88442]'
          : 'border border-border bg-white hover:bg-muted',
        className
      )}
    />
  );
}

export function Badge({ className, ...props }: DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>) {
  return <span {...props} className={cn('inline-flex rounded-full bg-muted px-2 py-1 text-xs', className)} />;
}
