import * as React from "react"

import { cn } from "@/lib/utils"

// Native <select> — same shell as Input so the two line up in a form row.
// Deliberately not a headless listbox: a native select gets the OS picker
// wheel on a phone, which is the only device this admin panel is used on.
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input dark:bg-input/30 flex min-h-11 md:min-h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { Select }
