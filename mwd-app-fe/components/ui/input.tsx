import * as React from "react";

import { cn } from "@/lib/utils";

function normalizeNumberInputValue(value: string) {
  if (!value) return value;

  const sign = value.startsWith("-") ? "-" : "";
  const unsignedValue = sign ? value.slice(1) : value;

  if (!unsignedValue || unsignedValue === "0" || unsignedValue.startsWith("0.")) {
    return value;
  }

  if (!/^0+\d/.test(unsignedValue)) {
    return value;
  }

  const normalized = unsignedValue.replace(/^0+(?=\d)/, "");
  return `${sign}${normalized || "0"}`;
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (type === "number") {
        const normalizedValue = normalizeNumberInputValue(event.currentTarget.value);

        if (normalizedValue !== event.currentTarget.value) {
          event.currentTarget.value = normalizedValue;
        }
      }

      onChange?.(event);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:px-3 sm:py-2 sm:file:text-sm",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
