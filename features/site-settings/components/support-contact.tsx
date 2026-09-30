"use client";

import { Clock, Mail, MessageCircle, Phone, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import { usePublicSettings } from "../hooks/use-site-settings";
import type { SupportSettings } from "../services/site-settings-service";

interface ContactLink {
  key: string;
  icon: typeof Phone;
  label: string;
  value: string;
  href: string;
}

/** Digits only, for a wa.me link; an Iranian 09… number becomes 989…. */
function whatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? `98${digits.slice(1)}` : digits;
}

export function supportLinks(support: SupportSettings): ContactLink[] {
  const links: ContactLink[] = [];
  if (support.phone) {
    links.push({
      key: "phone",
      icon: Phone,
      label: "تلفن",
      value: toPersianDigits(support.phone),
      href: `tel:${support.phone.replace(/\s/g, "")}`,
    });
  }
  if (support.whatsapp) {
    links.push({
      key: "whatsapp",
      icon: MessageCircle,
      label: "واتس‌اپ",
      value: toPersianDigits(support.whatsapp),
      href: `https://wa.me/${whatsappNumber(support.whatsapp)}`,
    });
  }
  if (support.telegram) {
    const handle = support.telegram.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
    links.push({
      key: "telegram",
      icon: Send,
      label: "تلگرام",
      value: `@${handle}`,
      href: `https://t.me/${handle}`,
    });
  }
  if (support.email) {
    links.push({
      key: "email",
      icon: Mail,
      label: "ایمیل",
      value: support.email,
      href: `mailto:${support.email}`,
    });
  }
  return links;
}

/**
 * The support contact the admin set in /admin/settings. Renders nothing when
 * none is set, so it can sit under any "contact support" message.
 */
export function SupportContact({ className }: { className?: string }) {
  const { support } = usePublicSettings();
  const links = supportLinks(support);
  if (links.length === 0) return null;

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <p className="font-medium text-foreground">راه‌های تماس با پشتیبانی</p>
      <ul className="flex flex-wrap justify-center gap-2">
        {links.map(({ key, icon: Icon, label, value, href }) => (
          <li key={key}>
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={label}
            >
              <Icon className="size-4" />
              <span dir="ltr">{value}</span>
            </a>
          </li>
        ))}
      </ul>
      {support.hours && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {support.hours}
        </p>
      )}
    </div>
  );
}
