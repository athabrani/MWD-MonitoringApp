"use client";

import Link, { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { AnchorHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps
  extends LinkProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName: _pendingClassName, href, ...props }, ref) => {
    const pathname = usePathname() ?? "/";
    const targetPath = typeof href === "string" ? href : href.pathname ?? "/";
    const isActive = normalizePath(pathname) === normalizePath(targetPath);

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive && activeClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
