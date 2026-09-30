"use client";

import { CircleHelp, Clock } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePublicSettings } from "../hooks/use-site-settings";
import { supportLinks } from "./support-contact";

/** The header's help button: the admin's support contacts, when there are any. */
export function SupportMenu() {
  const { support } = usePublicSettings();
  const links = supportLinks(support);
  if (links.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted sm:flex"
        aria-label="پشتیبانی"
      >
        <CircleHelp className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>تماس با پشتیبانی</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map(({ key, icon: Icon, label, value, href }) => (
          <DropdownMenuItem key={key} asChild>
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              <Icon />
              <span className="flex-1">{label}</span>
              <span dir="ltr" className="text-xs text-muted-foreground">
                {value}
              </span>
            </a>
          </DropdownMenuItem>
        ))}
        {support.hours && (
          <>
            <DropdownMenuSeparator />
            <p className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {support.hours}
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
