"use client";

import { PaymentAccountCard } from "@/features/finance/components/payment-account-card";
import { getClubPaymentInfo, saveClubPaymentInfo } from "../services/member-payments-service";

/** The card members send their membership fee to, for the club's owner and reception. */
export function ClubPaymentInfoCard({ clubId }: { clubId: string }) {
  return (
    <PaymentAccountCard
      title="دریافت شهریه از اعضا"
      description="ورزشکاران باشگاه این کارت را در صفحهٔ «عضویت من» می‌بینند، شهریه را به آن واریز می‌کنند و کد پیگیری و رسید را ثبت می‌کنند. شما بعد از دیدن واریز در حساب بانکی، پرداخت را در «پرداخت‌های اعضا» تأیید می‌کنید و عضویت خودکار تمدید می‌شود."
      queryKey={["member-payments", "club-info", clubId]}
      load={() => getClubPaymentInfo(clubId)}
      save={(info) => saveClubPaymentInfo(clubId, info)}
      alsoInvalidate={[["member-payments", "mine"]]}
    />
  );
}
