import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full resize-none rounded-md border border-grey-300 bg-paper px-3 py-2 text-sm text-ink placeholder:text-grey-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
