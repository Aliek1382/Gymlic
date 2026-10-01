"use client";

import { PaymentAccountCard } from "@/features/finance/components/payment-account-card";
import { saveTrainerPaymentInfo, getTrainerPaymentInfo } from "../services/invoice-service";

/** Where athletes send card-to-card payments for the trainer's invoices. */
export function TrainerPaymentInfoCard() {
  return (
    <PaymentAccountCard
      title="دریافت پرداخت از ورزشکاران"
      description="ورزشکارانی که فاکتور دارند این کارت را می‌بینند، به آن واریز می‌کنند و کد پیگیری و رسید را ثبت می‌کنند. شما بعد از دیدن واریز در حساب خود، پرداخت را تأیید می‌کنید. شمارهٔ کارت فقط برای ورزشکاری که از شما فاکتور دارد دیده می‌شود."
      queryKey={["invoices", "payment-info"]}
      load={getTrainerPaymentInfo}
      save={saveTrainerPaymentInfo}
      alsoInvalidate={[["invoices", "mine"]]}
    />
  );
}
