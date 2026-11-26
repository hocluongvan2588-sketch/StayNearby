export type PaymentProvider = 'vietqr' | 'stripe';
export type PaymentPurpose = 'booking_fee' | 'membership_pass';

export const NOMAD_PASS_PRICE_VND = 2_680_000;

export interface PaymentGatewayStatus {
  stripeLive: boolean;
  vietqrLive: boolean;
  nomadPassPriceVnd: number;
  vietqrBankPreview: {
    bankBin: string;
    accountNoMasked: string;
    accountName: string;
  } | null;
}

export interface GatewayTransactionDTO {
  id: string;
  purpose: PaymentPurpose;
  bookingId: string | null;
  provider: PaymentProvider | 'sandbox';
  mode: 'live' | 'sandbox';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  amountVnd: number;
  currency: string;
  referenceCode: string;
  checkoutUrl: string | null;
  qrImageUrl: string | null;
  bankDetails: {
    bankBin: string;
    accountNo: string;
    accountName: string;
  } | null;
}
