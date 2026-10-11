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
  payment_method: "bank" | "stc";
  recharge_pin: string | null;
  screenshot_path: string | null;
  payment_status: "pending" | "verified" | "rejected";
  status: "pending" | "confirmed" | "completed" | "cancelled";
  extra_enabled: boolean;
  extra_amount: number;
  extra_method: "bank" | "stc" | null;
  extra_recharge_pin: string | null;
  extra_screenshot_path: string | null;
  extra_payment_status: "none" | "awaiting" | "under_verification" | "verified" | "rejected";
  created_at: string;
};
