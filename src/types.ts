export type RoleName = "admin" | "factory_ground_staff" | "tour_user" | (string & {});

export type PermissionKey =
  | "dashboard.view"
  | "inventory.view"
  | "inventory.manage"
  | "inventory.stock.update"
  | "inventory.transactions.view"
  | "sales.billing.create"
  | "sales.billing.view"
  | "sales.returns.create"
  | "customers.manage"
  | "collections.manage"
  | "reports.view"
  | "settings.view"
  | "settings.manage"
  | "users.manage"
  | "roles.manage"
  | "data.manage"
  | "audit.view"
  | (string & {});

export type RoleDefinition = {
  id: string;
  label: string;
  description: string;
  permissions: PermissionKey[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password_hash: string;
  role: RoleName;
  permissions: PermissionKey[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  address: string;
  credit_balance: number;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  qr_code: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryTransactionType = "ADD" | "REMOVE" | "SALE" | "RETURN" | "ADJUSTMENT";

export type InventoryTransaction = {
  id: string;
  product_id: string;
  type: InventoryTransactionType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type?: string;
  reference_id?: string;
  note?: string;
  created_by: string;
  created_at: string;
};

export type InvoiceStatus = "PAID" | "UNPAID" | "PARTIAL";

export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  subtotal: number;
  discount: number;
  grand_total: number;
  amount_paid: number;
  balance_amount: number;
  status: InvoiceStatus;
  created_by: string;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
};

export type CartItem = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  available_stock: number;
};

export type SalesReturn = {
  id: string;
  return_number: string;
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  total_amount: number;
  items_count: number;
  created_by: string;
  created_at: string;
  reason?: string;
};

export type SalesReturnItem = {
  id: string;
  sales_return_id: string;
  invoice_item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type LedgerEntryType = "SALE" | "PAYMENT" | "RETURN" | "ADJUSTMENT";

export type CustomerLedgerEntry = {
  id: string;
  customer_id: string;
  entry_type: LedgerEntryType;
  reference_type: string;
  reference_id: string;
  reference_number?: string;
  debit: number;
  credit: number;
  balance_after: number;
  note?: string;
  created_by?: string;
  created_at: string;
};

// --- Daily Collection Pro ---
export type CollectionStatus = "OPEN" | "LOCKED";

export type CollectionSession = {
  id: string;
  session_number: string;
  collection_date: string;
  title?: string;
  total_clients: number;
  paid_clients: number;
  pending_clients: number;
  total_collected: number;
  pending_amount: number;
  status: CollectionStatus;
  locked_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CollectionRowStatus = "PAID" | "PENDING" | "UNPAID";

export type CollectionRow = {
  id: string;
  session_id: string;
  serial: number;
  customer_id?: string;
  customer_name: string;
  customer_mobile?: string;
  amount_expected?: number;
  amount_received: number;
  status: CollectionRowStatus;
  due_date?: string;
  notes?: string;
  collected_at?: string;
  collected_by?: string;
  updated_at: string;
};
