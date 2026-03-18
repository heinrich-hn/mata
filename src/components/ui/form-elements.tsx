import { Input as ShadcnInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea as ShadcnTextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id?: string;
}

export const Input = ({
  label,
  error,
  className,
  id,
  ...props
}: InputProps) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <ShadcnInput
        id={inputId}
        className={cn(error && 'border-destructive', className)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  id?: string;
}

export const TextArea = ({
  label,
  error,
  className,
  id,
  ...props
}: TextAreaProps) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${textareaId}-error`;

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={textareaId}>{label}</Label>}
      <ShadcnTextarea
        id={textareaId}
        className={cn(error && 'border-destructive', className)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

export const Select = ({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
  className,
  id,
  placeholder,
}: SelectProps) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${selectId}-error`;
  const descriptionId = `${selectId}-description`;

  // Compute aria-describedby value
  const describedBy = [
    error ? errorId : '',
    !label ? descriptionId : ''
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={selectId}>{label}</Label>}
      
      {/* Add a visually hidden description for screen readers if no label */}
      {!label && (
        <span id={descriptionId} className="sr-only">
          Select an option from the dropdown
        </span>
      )}

      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        title={!label ? 'Select option' : undefined}
      >
        {placeholder && !value && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};