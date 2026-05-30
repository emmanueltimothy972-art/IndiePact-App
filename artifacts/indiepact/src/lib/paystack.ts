declare global {
  interface Window {
    PaystackPop: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }): { openIframe(): void };
    };
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return; }
    const existing = document.getElementById("paystack-inline-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "paystack-inline-js";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export interface PaystackPayOptions {
  email: string;
  amountCents: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export async function initiatePaystackPayment(options: PaystackPayOptions): Promise<void> {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    throw new Error("Paystack public key is not configured. Set VITE_PAYSTACK_PUBLIC_KEY in your environment.");
  }

  await loadPaystackScript();

  const ref = `ip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const handler = window.PaystackPop.setup({
    key: publicKey,
    email: options.email,
    amount: options.amountCents,
    currency: options.currency ?? "USD",
    ref,
    metadata: options.metadata,
    callback: (response) => options.onSuccess(response.reference),
    onClose: options.onClose,
  });

  handler.openIframe();
}
