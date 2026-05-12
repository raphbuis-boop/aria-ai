import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — shadcn-style variants skinned with Aria's design tokens.
 *
 * Variants mirror shadcn defaults so any shadcn recipe still works,
 * but defaults are tuned to the existing dark Aria theme
 * (accent-blue primary, bg-card surfaces, border-card outlines).
 *
 * Use `asChild` to render the button as another element while keeping
 * the styling (e.g. wrapping a Next.js <Link>).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent-blue text-white hover:bg-accent-blue-glow active:bg-accent-blue-glow",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 active:bg-red-700",
        outline:
          "border border-border-card bg-bg-deep text-text-primary hover:bg-bg-card hover:text-text-primary",
        secondary:
          "bg-bg-card text-text-primary border border-border-card hover:bg-[#181818]",
        ghost:
          "text-text-primary hover:bg-bg-card hover:text-text-primary",
        link:
          "text-accent-blue-bright underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[8px] px-3 text-xs",
        lg: "h-11 rounded-[12px] px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
