-- Payment Gateway Framework (Stripe Checkout + VietQR / SePay / PayOS ready)

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('booking_fee', 'membership_pass')),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'vietqr', 'sandbox')),
  mode TEXT NOT NULL CHECK (mode IN ('live', 'sandbox')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  amount_vnd BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  reference_code TEXT NOT NULL UNIQUE,
  external_session_id TEXT,
  external_payment_id TEXT,
  checkout_url TEXT,
  qr_image_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_booking ON payment_transactions (booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON payment_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_tx_external_session ON payment_transactions (external_session_id);
