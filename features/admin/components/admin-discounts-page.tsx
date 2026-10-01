"use client";

import { DiscountCodesManager, type DiscountManagerConfig } from "./discount-codes-manager";
import {
  createDiscountCode,
  deleteDiscountCode,
  listDiscountCodes,
  updateDiscountCode,
} from "../services/admin-billing-service";

const CLUB_CONFIG: DiscountManagerConfig = {
  queryKey: ["admin", "discounts"],
  load: listDiscountCodes,
  create: createDiscountCode,
  update: updateDiscountCode,
  remove: deleteDiscountCode,
  onceLabel: "هر باشگاه فقط یک بار",
  onceBadge: "یک بار برای هر باشگاه",
  notReady: "به‌روزرسانی «کد تخفیف اشتراک (فاز ۶)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.",
  emptyText: "با «کد جدید» اولین کد را بسازید.",
};

export function AdminDiscountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">کدهای تخفیف</h1>
        <p className="text-sm text-muted-foreground">
          باشگاه‌ها هنگام ثبت درخواست پرداخت اشتراک، کد را وارد می‌کنند و مبلغ با تخفیف حساب
          می‌شود. هر درخواستِ در انتظار یا تأییدشده یک بار استفاده حساب می‌شود؛ درخواستی که رد
          شود، استفاده‌اش برمی‌گردد. کدهای مربیان در «اشتراک مربیان» هستند.
        </p>
      </div>
      <DiscountCodesManager config={CLUB_CONFIG} />
    </div>
  );
}
