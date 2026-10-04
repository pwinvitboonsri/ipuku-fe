// API v1 shapes, taken from the ipuku-be entities / Prisma schema.

export type Role = "OWNER" | "STAFF";

// GET /auth (login grid) returns only { id, name } per staff — no role.
export type Staff = {
  id: string;
  name: string;
  role?: Role;
  is_active?: boolean;
};

export type SessionStaff = { id: string; name: string; role: Role };

// ── GET /menu (menu.service.ts select) ─────────────────────────────
export type MenuOption = { id: string; name: string; price_delta_satang: number; sort_order: number };
export type MenuGroupLink = {
  sort_order: number;
  modifier_group: { id: string; name: string; min_select: number; max_select: number; modifier_option: MenuOption[] };
};
// From the product's base recipe (menu/function/product-stock.function.ts). Warn only — still sellable.
export type StockStatus = "OK" | "LOW" | "OUT";
export type ProductStock = { status: StockStatus; ingredients: { id: string; name: string; status: Exclude<StockStatus, "OK"> }[] };
export type MenuProductRaw = { id: string; name: string; price_satang: number; image_url: string | null; stock: ProductStock; modifier_group: MenuGroupLink[] };
export type MenuCategoryRaw = { id: string; name: string; sort_order: number; product: MenuProductRaw[] };

// Flattened for the UI
export type MenuGroup = { id: string; name: string; min: number; max: number; options: MenuOption[] };
export type MenuProduct = { id: string; name: string; price_satang: number; image_url: string | null; categoryId: string; stock: ProductStock; groups: MenuGroup[] };

// POST /order/:id/pay → meta.stock_alerts: ingredients this sale just took to/below reorder level, or out.
// Quantities are hundredths of the unit.
export type StockAlert = { ingredient_id: string; name: string; unit: string; stock_quantity: number; reorder_level: number; status: "LOW" | "OUT" };
export type MenuCategory = { id: string; name: string; products: MenuProduct[] };

// ── Orders (order.entity.ts + orderInclude) ────────────────────────
export type OrderStatus = "OPEN" | "PAID" | "VOIDED" | "REFUNDED";
export type PaymentMethod = "CASH" | "PROMPTPAY";

export type OrderItemModifier = { id: string; price_delta_satang: number; name_snapshot: string; modifier_option_id: string };
export type OrderItem = {
  id: string;
  quantity: number;
  unit_price_satang: number;
  line_total_satang: number;
  product_name_snapshot: string;
  product_id: string;
  order_item_modifier: OrderItemModifier[];
};
// One row per tender (a mixed payment has several). A refund adds a negative row per tender.
export type Payment = {
  id: string;
  method: PaymentMethod;
  amount_satang: number;
  tender_satang: number | null;
  change_satang: number | null;
  reference: string | null;
  marked_by_staff_id: string;
  create_at: string;
};
export type Order = {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal_satang: number;
  discount_satang: number;
  total_satang: number;
  client_order_id: string;
  paid_at: string | null;
  cash_session_id: string;
  staff_id: string;
  create_at: string;
  order_item: OrderItem[];
  payment: Payment[];
};

// ── Back office (category / product / modifier / ingredient / recipe / stock-movement entities) ──
export type Category = { id: string; name: string; sort_order: number; is_active: boolean };
export type Product = { id: string; name: string; price_satang: number; image_url: string | null; category_id: string; is_active: boolean };
export type ModifierOptionRow = { id: string; name: string; price_delta_satang: number; sort_order: number; is_active: boolean; group_id: string };
export type ModifierGroupRow = { id: string; name: string; min_select: number; max_select: number; is_active: boolean; modifier_option: ModifierOptionRow[] };
export type ProductGroupLink = { product_id: string; modifier_group_id: string; sort_order: number; modifier_group: ModifierGroupRow };
// Quantities are hundredths of the unit (150 ml = 15000)
export type Ingredient = { id: string; name: string; unit: string; stock_quantity: number; reorder_level: number; is_active: boolean };
export type RecipeLine = { id: string; quantity_per_unit: number; product_id: string; ingredient_id: string; ingredient: { id: string; name: string; unit: string } };
// Product × option line: added to (negative = taken from) the base recipe when that option is sold
export type RecipeModifierLine = {
  id: string;
  quantity_delta: number;
  product_id: string;
  modifier_option_id: string;
  ingredient_id: string;
  ingredient: { id: string; name: string; unit: string };
  modifier_option: { id: string; name: string; group_id: string };
};
export type StockReason = "SALE" | "RESTOCK" | "WASTE" | "COUNT_CORRECTION";
export type StockMovement = {
  id: string;
  change_quantity: number;
  reason: StockReason;
  note: string | null;
  ingredient_id: string;
  order_id: string | null;
  create_at: string;
  ingredient: { id: string; name: string; unit: string };
};
// GET /auth/staff (owner): full staff rows, pin_hash excluded
export type StaffRow = { id: string; name: string; role: Role; is_active: boolean; create_at: string };

// CashSession has staff ids only; names come from the staff list.
export type CashSession = {
  id: string;
  opening_float_satang: number;
  counted_cash_satang: number | null;
  expect_cash_satang: number | null;
  variance_satang: number | null;
  open_at: string;
  close_at: string | null;
  opened_by_staff_id: string;
  close_by_staff_id: string | null;
  // GET /cash-session (list) only: PAID orders and their total = net sales
  paid_orders?: number;
  net_sales_satang?: number;
};

// ── GET /cash-session/:id/report (cash-session/function/build-shift-report.function.ts) ──
type StaffRef = { id: string; name: string };
export type ReportAdjustment = {
  order_id: string;
  order_number: number;
  amount_satang: number;
  // MIXED: refunded as more than one method
  method: PaymentMethod | "MIXED" | null;
  staff_name: string | null;
  at: string;
  reason: string | null;
};
export type ShiftReport = {
  session: {
    id: string;
    open_at: string;
    close_at: string | null;
    duration_minutes: number | null;
    opened_by: StaffRef;
    closed_by: StaffRef | null;
    first_order_number: number | null;
    last_order_number: number | null;
  };
  summary: {
    gross_sales_satang: number;
    discounts_satang: number;
    refunds_satang: number;
    net_sales_satang: number;
    paid_orders: number;
    items_sold: number;
    avg_ticket_satang: number;
    split_orders: number;
  };
  tenders: { method: PaymentMethod; count: number; sales_satang: number; refunds_satang: number; net_satang: number }[];
  cash: {
    opening_float_satang: number;
    cash_sales_satang: number;
    cash_refunds_satang: number;
    expected_satang: number;
    counted_satang: number | null;
    variance_satang: number | null;
    tendered_satang: number;
    change_given_satang: number;
  };
  voids: { count: number; amount_satang: number; list: ReportAdjustment[] };
  refunds: { count: number; amount_satang: number; list: ReportAdjustment[] };
  items: { product_id: string; name: string; category_name: string; quantity: number; revenue_satang: number }[];
  categories: { category_id: string; name: string; quantity: number; revenue_satang: number }[];
  modifiers: { modifier_option_id: string; name: string; quantity: number; revenue_satang: number }[];
  staff: { staff_id: string; name: string; paid_orders: number; net_sales_satang: number; voids: number; refunds: number }[];
  hourly: { hour_start: string; orders: number; net_sales_satang: number }[];
};
