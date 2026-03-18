import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const Button = ({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className,
  ...props
}: ButtonProps) => {
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  const variantClasses = {
    default: '',
    outline: '',
    ghost: '',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    success: 'bg-success text-success-foreground hover:bg-success/90',
  };

  const shadcnVariant = variant === 'danger' || variant === 'success' ? 'default' : variant;

  return (
    <ShadcnButton
      variant={shadcnVariant}
      className={cn(
        sizeClasses[size],
        variant === 'danger' || variant === 'success' ? variantClasses[variant] : '',
        className
      )}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </ShadcnButton>
  );
};

export default Button;