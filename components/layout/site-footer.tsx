import { Camera, Mail, MessageCircle, Send } from "lucide-react";

const CONTACTS = [
  { label: "تلگرام", href: "https://t.me/ekramic", icon: Send },
  { label: "اینستاگرام", href: "https://instagram.com/gymlic", icon: Camera },
  { label: "واتساپ", href: "https://wa.me/989399733112", icon: MessageCircle },
  { label: "ایمیل", href: "mailto:gymlicapp@gmail.com", icon: Mail },
] as const;

/**
 * Site-wide footer (root layout): ways to reach us plus the eNamad trust seal. It is a Server
 * Component on purpose — the eNamad crawler reads the seal from the static
 * HTML of the home page, so it must not wait for client-side rendering.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">ارتباط با ما</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {CONTACTS.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* eNamad's snippet, verbatim. It must not carry rel="noopener
            noreferrer": that stops the seal from being detected on the site. */}
        <a
          referrerPolicy="origin"
          target="_blank"
          href="https://trustseal.enamad.ir/?id=8087646&Code=qvhM5lhVcVtHm2dd9OQiO0BusnT7z7gC"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            referrerPolicy="origin"
            src="https://trustseal.enamad.ir/logo.aspx?id=8087646&Code=qvhM5lhVcVtHm2dd9OQiO0BusnT7z7gC"
            alt=""
            style={{ cursor: "pointer" }}
            {...{ code: "qvhM5lhVcVtHm2dd9OQiO0BusnT7z7gC" }}
          />
        </a>
      </div>
    </footer>
  );
}
