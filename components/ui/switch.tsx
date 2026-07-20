"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted focus-visible:ring-ring/30 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background pointer-events-none block size-5 rounded-full shadow-sm ring-0 transition-transform",
          "data-[state=checked]:-translate-x-4 data-[state=unchecked]:-translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
