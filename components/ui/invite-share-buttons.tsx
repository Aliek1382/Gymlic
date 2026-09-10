import { MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/invite-share";

// Opens WhatsApp/Telegram with the invite link pre-filled, so sending it
// doesn't require leaving the panel to copy-paste into another app by hand.
// WhatsApp can target the invitee's number directly; Telegram always opens
// its own contact picker (see buildTelegramShareUrl).
export function InviteShareButtons({
  link,
  phone,
  message,
  fullWidth = false,
}: {
  link: string;
  phone?: string | null;
  message?: string;
  fullWidth?: boolean;
}) {
  const text = message ?? `برای پذیرش دعوت روی این لینک بزنید:\n${link}`;

  return (
    <div className="flex gap-2">
      <Button
        asChild
        variant="outline"
        size="sm"
        className={fullWidth ? "flex-1" : undefined}
      >
        <a
          href={buildWhatsAppShareUrl(text, phone)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle />
          واتساپ
        </a>
      </Button>
      <Button
        asChild
        variant="outline"
        size="sm"
        className={fullWidth ? "flex-1" : undefined}
      >
        <a
          href={buildTelegramShareUrl(link, text)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Send />
          تلگرام
        </a>
      </Button>
    </div>
  );
}
