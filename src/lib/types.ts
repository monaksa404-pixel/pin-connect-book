export type Service = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_min: number;
  image_url: string | null;
  popular: boolean;
  active: boolean;
  sort: number;
};

export type Settings = {
  salon_name: string;
  tagline: string | null;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  iban: string | null;
  bank_qr_url: string | null;
  bank_enabled: boolean;
  stc_enabled: boolean;
  bookings_full: boolean;
  full_message: string | null;
  advance_percent: number;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  map_url: string | null;
};

export type BookingItem = { service_id: string; name: string; price: number; qty: number };

export type Booking = {
  id: string;
  code: string;
  user_id: string;
  customer_name: string;
  phone: string;
  city: string | null;
  notes: string | null;
  booking_date: string;
  booking_time: string;
  items: BookingItem[];
  total: number;
  advance_amount: number;
  remaining_amount: number;
  payment_method: "bank" | "wallet";
  recharge_pin: string | null;
  bank_account_id: string | null;
  user_code: string | null;
  admin_note: string | null;
  extra_admin_note: string | null;
  screenshot_path: string | null;
  payment_status: "pending" | "verified" | "rejected";
  status: "pending" | "confirmed" | "completed" | "cancelled";
  extra_enabled: boolean;
  extra_amount: number;
  extra_method: "bank" | "wallet" | null;
  extra_recharge_pin: string | null;
  extra_screenshot_path: string | null;
  extra_payment_status: "none" | "awaiting" | "under_verification" | "verified" | "rejected";
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  user_code: string | null;
  wallet_balance: number;
  allow_bank: boolean;
  allow_wallet: boolean;
  bank_account_id: string | null;
  assigned_whatsapp: string | null;
  assigned_address: string | null;
  assigned_map_url: string | null;
  contact_enabled: boolean;
  created_at: string;
};

export type BankAccount = {
  id: string;
  account_name: string;
  bank_name: string | null;
  account_holder: string;
  account_number: string | null;
  iban: string;
  qr_url: string | null;
  active: boolean;
};

export type Topup = {
  id: string;
  ref: string;
  user_id: string;
  user_code: string | null;
  pin: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  created_at: string;
};
