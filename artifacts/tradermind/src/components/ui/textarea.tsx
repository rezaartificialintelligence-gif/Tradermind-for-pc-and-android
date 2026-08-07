import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.ComponentProps<'textarea'> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, inputMode, autoCorrect, spellCheck, enterKeyHint, wrap, ...props }, ref) => (
    <textarea
      inputMode={inputMode ?? 'text'}
      autoCorrect={autoCorrect ?? 'on'}
      spellCheck={spellCheck ?? true}
      enterKeyHint={enterKeyHint ?? 'enter'}
      wrap={wrap ?? 'soft'}
      className={cn(
      'flex min-h-[60px] w-full whitespace-pre-wrap rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';
export { Textarea };
