import { ApiError, api, getApiBaseUrl, getToken } from "@/lib/api/client";
import { compressImageToBlob } from "@/lib/image-compression";

export interface SubmitPaymentRequestInput {
  planId: string;
  amountToman: number;
  referenceNote?: string;
  discountCode?: string;
  /** Bank tracking number, and the last four digits of the card paid from. */
  trackingCode?: string;
  cardLast4?: string;
  /** When the transfer was made (a datetime-local value), if the club knows. */
  paidAt?: string;
  /** Photo or PDF of the receipt. */
  receipt?: File | null;
}

/** The club is resolved server-side from the caller's ownership. */
export async function submitPaymentRequest(input: SubmitPaymentRequestInput) {
  const fields = {
    plan_id: input.planId,
    amount_toman: input.amountToman,
    reference_note: input.referenceNote || null,
    discount_code: input.discountCode || null,
    tracking_code: input.trackingCode || null,
    card_last4: input.cardLast4 || null,
    paid_at: input.paidAt || null,
  };

  if (!input.receipt) {
    await api.post("/payment-requests", fields);
    return;
  }

  // Multipart: every field as text, the receipt under its own name.
  const text: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined) text[key] = String(value);
  }
  await api.upload("/payment-requests", input.receipt, text, "receipt");
}

/** The club takes back a request the admin has not answered yet. */
export async function cancelPaymentRequest(id: string): Promise<void> {
  await api.delete(`/payment-requests/${id}`);
}

/**
 * Shrinks a receipt photo in the browser before it is sent (the server
 * shrinks it again, but this keeps the upload small on a slow phone
 * connection). A PDF, or a picture the browser can't decode (HEIC), goes as it
 * is and the server decides.
 */
export async function prepareReceipt(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const blob = await compressImageToBlob(file, {
      maxDimension: 1400,
      initialQuality: 0.8,
      maxBytes: 400 * 1024,
      minQuality: 0.5,
    });
    return new File([blob], "receipt.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export type ReceiptKind = "payment-request" | "invoice-claim" | "trainer-payment" | "membership-payment";

/**
 * The receipt file of a club's payment request, or of an athlete's claim
 * against a trainer's invoice, as a blob (the endpoint needs the login header).
 */
export async function fetchReceiptBlob(id: string, kind: ReceiptKind = "payment-request"): Promise<Blob> {
  const token = getToken();
  const path = {
    "payment-request": `/payment-requests/${id}/receipt`,
    "invoice-claim": `/invoice-claims/${id}/receipt`,
    "trainer-payment": `/trainer-billing/requests/${id}/receipt`,
    "membership-payment": `/member-payments/${id}/receipt`,
  }[kind];
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.", 0, "network_error");
  }
  if (!response.ok) {
    let message = "دریافت رسید ناموفق بود.";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Not JSON: keep the generic message.
    }
    throw new ApiError(message, response.status, "receipt_unavailable");
  }
  return response.blob();
}

export interface PaymentInfo {
  card_number: string;
  sheba: string;
  account_holder: string;
  bank_name: string;
  instructions: string;
}

export interface BillingInfo {
  payment: PaymentInfo;
  /** False until the database has the discount-code tables. */
  discounts_enabled: boolean;
  /** What the dialog asks for besides the amount; null until the receipts database update has run. */
  receipts: ReceiptRules | null;
}

export interface ReceiptRules {
  required: boolean;
  max_mb: number;
  /** Days after review that the file is deleted; 0 = kept. */
  retention_days: number;
}

/** Never throws: an older backend without it just shows no payment details. */
export async function getBillingInfo(): Promise<BillingInfo | null> {
  try {
    return await api.get<BillingInfo>("/billing/info");
  } catch {
    return null;
  }
}

export interface DiscountQuote {
  code: string;
  list_price_toman: number;
  discount_toman: number;
  final_toman: number;
}

export async function checkDiscountCode(planId: string, code: string): Promise<DiscountQuote> {
  return api.post<DiscountQuote>("/billing/discount-check", { plan_id: planId, code });
}
