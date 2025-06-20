import * as React from "react";

import { cn } from "../../lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, onBlur, ...props }, ref) => {
  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Prevent mobile zoom on focus
    if (window.innerWidth < 768) {
      // Small delay to ensure the keyboard is shown
      setTimeout(() => {
        // Smooth scroll to bring input into view without aggressive zoom
        e.target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 300);
    }
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onBlur?.(e);
  };

  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-[16px]",
        className,
      )}
      ref={ref}
      style={{
        fontSize: '16px', // Prevent mobile zoom
        touchAction: 'manipulation', // Prevent double-tap zoom
        ...props.style,
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
