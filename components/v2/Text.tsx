"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TextVariant = "primary" | "secondary" | "muted";
type TextSize = "xs" | "sm" | "base" | "md" | "lg" | "xl";
type TextAs = "p" | "span" | "h1" | "h2" | "h3" | "h4" | "label" | "div";

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  size?: TextSize;
  weight?: "normal" | "medium" | "semibold" | "bold";
  as?: TextAs;
  truncate?: boolean;
}

const variantClass: Record<TextVariant, string> = {
  primary: "text-[#E5E4E2]",
  secondary: "text-[#9A9CA3]",
  muted: "text-[#5E6068]",
};

const sizeClass: Record<TextSize, string> = {
  xs: "text-[0.6875rem]",
  sm: "text-xs",
  base: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};

const weightClass = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

export function Text({
  variant = "primary",
  size = "base",
  weight = "normal",
  as: Tag = "p",
  truncate,
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(
        variantClass[variant],
        sizeClass[size],
        weightClass[weight],
        truncate && "truncate",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
