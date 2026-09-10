import { MessageCircle, MessageSquare, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildEitaaShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/invite-share";

// Opens WhatsApp/Telegram/Eitaa with the invite link pre-filled, so sending
// it doesn't require leaving the panel to copy-paste into another app by
// hand. WhatsApp can target the invitee's number directly; Telegram and
// Eitaa always open their own contact picker (see their build*ShareUrl).
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
    <div className="flex flex-wrap gap-2">
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
      <Button
        asChild
        variant="outline"
        size="sm"
        className={fullWidth ? "flex-1" : undefined}
      >
        <a
          href={buildEitaaShareUrl(link, text)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageSquare />
          ایتا
        </a>
      </Button>
    </div>
  );
}
