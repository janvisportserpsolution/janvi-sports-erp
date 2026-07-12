import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Customer,
  CustomerLedgerEntry,
  InventoryTransaction,
  Invoice,
  InvoiceItem,
  PermissionKey,
  Product,
  SalesReturn,
  SalesReturnItem,
  User,
  CollectionSession,
  CollectionRow,
} from "./types";
import { nowISO, uid } from "./utils/id";
import { ALL_PERMISSIONS } from "./rbac";
import {
  appStateRef,
  createSecondaryAuthUser,
  ensureUserProfile,
  logoutFirebase,
  onFirebaseAuthChanged,
  signInOrBootstrapDemoUser,
  userProfileRef,
} from "./firebase";
import { getDoc, onSnapshot, setDoc } from "firebase/firestore";

type AuthState = {
  user: User | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
};

const normalizeEmail = (value?: string | null) => (value ?? "").trim().toLowerCase();

const createDemoUser = (email: string, password: string, role: User["role"]): User => ({
  id: uid("user"),
  name: role === "admin" ? "Admin" : role === "factory_ground_staff" ? "Factory Staff" : "Tour User",
  email,
  mobile: role === "admin" ? "9999999999" : role === "factory_ground_staff" ? "7777777777" : "6666666666",
  password_hash: password,
  role,
  permissions: role === "admin" ? ALL_PERMISSIONS : [],
  is_active: true,
  created_at: nowISO(),
  updated_at: nowISO(),
});

const getDemoUserByCredentials = (email: string, password: string): User | null => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) return null;
  const demoUsers: Record<string, User> = {
    "admin@janvisports.com": createDemoUser("admin@janvisports.com", "admin123", "admin"),
    "factory@janvisports.com": createDemoUser("factory@janvisports.com", "factory123", "factory_ground_staff"),
    "tour@janvisports.com": createDemoUser("tour@janvisports.com", "tour123", "tour_user"),
  };
  const demoUser = demoUsers[normalizedEmail];
  if (demoUser?.password_hash === password) return demoUser;
  return null;
};

const normalizeStoredUser = (user: User | null | undefined): User | null => {
  if (!user) return null;

  const demoUser = getDemoUserByCredentials(user.email ?? "", user.password_hash ?? "");
  if (demoUser) return demoUser;

  const matchedUser = useData.getState().users.find((candidate) => {
    const sameId = candidate.id === user.id;
    const sameEmail = normalizeEmail(candidate.email) && normalizeEmail(user.email) && normalizeEmail(candidate.email) === normalizeEmail(user.email);
    const sameMobile = Boolean(candidate.mobile && user.mobile && candidate.mobile === user.mobile);
    return sameId || sameEmail || sameMobile;
  });

  if (matchedUser) {
    return {
      ...user,
      ...matchedUser,
      email: matchedUser.email ?? user.email ?? "",
      mobile: matchedUser.mobile ?? user.mobile ?? "",
      role: matchedUser.role,
      permissions: matchedUser.permissions ?? [],
      is_active: matchedUser.is_active,
    };
  }

  if (normalizeEmail(user.email) === "admin@janvisports.com" && user.password_hash === "admin123") {
    return {
      ...user,
      role: "admin",
      permissions: ALL_PERMISSIONS,
      is_active: true,
    };
  }

  return user;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      authReady: false,
      login: async (email, password) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !password.trim()) return { ok: false, message: "Email and password are required" };
        try {
          const user = await signInOrBootstrapDemoUser(normalizedEmail, password);
          if (!user.is_active) {
            await logoutFirebase();
            set({ user: null });
            return { ok: false, message: "This account is inactive" };
          }
          set({ user: normalizeStoredUser(user), authReady: true });
          return { ok: true, message: "Welcome back, " + user.name };
        } catch {
          return { ok: false, message: "Invalid email or password" };
        }
      },
      logout: async () => {
        await logoutFirebase().catch(() => undefined);
        set({ user: null, authReady: true });
      },
    }),
    {
      name: "janvi-auth",
      merge: (persistedState, currentState) => ({
        ...(currentState as AuthState),
        ...(persistedState as Partial<AuthState>),
        user: normalizeStoredUser((persistedState as Partial<AuthState>).user ?? null),
        authReady: false,
      }),
    }
  )
);

type DataState = {
  users: User[];
  customers: Customer[];
  products: Product[];
  inventoryTransactions: InventoryTransaction[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  salesReturns: SalesReturn[];
  salesReturnItems: SalesReturnItem[];
  ledger: CustomerLedgerEntry[];

  // Daily Collection Pro
  collectionSessions: CollectionSession[];
  collectionRows: CollectionRow[];

  initialized: boolean;
  syncReady: boolean;

  // Customers
  addCustomer: (data: Omit<Customer, "id" | "created_at" | "updated_at" | "credit_balance"> & { credit_balance?: number }) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Products
  addProduct: (data: Omit<Product, "id" | "created_at" | "updated_at" | "qr_code"> & { qr_code?: string }) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addStock: (productId: string, qty: number, note?: string) => { ok: boolean; message: string };
  removeStock: (productId: string, qty: number, note?: string) => { ok: boolean; message: string };

  // Invoices
  createInvoice: (input: {
    customer_id: string;
    items: { product_id: string; quantity: number; unit_price: number }[];
    discount: number;
    amount_paid: number;
    created_by: string;
  }) => { ok: boolean; message: string; invoice?: Invoice };

  // Returns
  createReturn: (input: {
    invoice_id: string;
    items: { invoice_item_id: string; quantity: number }[];
    reason?: string;
    created_by: string;
  }) => { ok: boolean; message: string; salesReturn?: SalesReturn };

  // Customer payment
  recordPayment: (customer_id: string, amount: number, created_by: string, note?: string) => { ok: boolean; message: string };

  // Collection Pro
  createCollectionSession: (input: {
    title?: string;
    collection_date: string;
    names_raw: string;
    created_by: string;
  }) => { ok: boolean; session_id?: string; message: string };
  updateCollectionRow: (row_id: string, patch: Partial<CollectionRow>) => void;
  setCollectionRowPayment: (row_id: string, amount: number, status: CollectionRow["status"], due_date?: string, notes?: string) => void;
  reorderCollectionRows: (session_id: string, row_ids: string[]) => void;
  deleteCollectionRow: (row_id: string) => void;
  addCollectionRow: (session_id: string, customer_name: string) => void;
  lockCollectionSession: (session_id: string) => { ok: boolean; message: string };
  unlockCollectionSession: (session_id: string) => void;
  deleteCollectionSession: (session_id: string) => void;
  postCollectionToLedger: (session_id: string) => { ok: boolean; posted: number; message: string };

  // Users / RBAC
  createUser: (input: Omit<User, "id" | "created_at" | "updated_at">) => Promise<{ ok: boolean; message: string; user?: User }>;
  updateUser: (id: string, patch: Partial<User>) => { ok: boolean; message: string };
  deleteUser: (id: string) => { ok: boolean; message: string };
  setUserPermissions: (id: string, permissions: PermissionKey[]) => { ok: boolean; message: string };

  // Seeding
  seed: () => void;
  resetAll: () => void;
};

const seedUsers = (): User[] => [
  {
    id: uid("user"),
    name: "Admin",
    email: "admin@janvisports.com",
    mobile: "9999999999",
    password_hash: "admin123",
    role: "admin",
    permissions: [],
    is_active: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    id: uid("user"),
    name: "Factory Staff",
    email: "factory@janvisports.com",
    mobile: "7777777777",
    password_hash: "factory123",
    role: "factory_ground_staff",
    permissions: [],
    is_active: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  },
  {
    id: uid("user"),
    name: "Tour User",
    email: "tour@janvisports.com",
    mobile: "6666666666",
    password_hash: "tour123",
    role: "tour_user",
    permissions: [],
    is_active: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  },
];

const seedProducts = (): Product[] => {
  const items: Omit<Product, "id" | "created_at" | "updated_at" | "qr_code" | "is_active">[] = [
    { name: "Nike Air Zoom Running Shoes", sku: "NK-AZ-001", selling_price: 5499, cost_price: 3200, stock_quantity: 25, low_stock_threshold: 5, category: "Footwear" },
    { name: "Adidas Cricket Bat - English Willow", sku: "AD-CB-101", selling_price: 8999, cost_price: 5200, stock_quantity: 12, low_stock_threshold: 3, category: "Cricket" },
    { name: "SG Test Leather Ball (Red)", sku: "SG-TB-220", selling_price: 899, cost_price: 480, stock_quantity: 60, low_stock_threshold: 15, category: "Cricket" },
    { name: "Yonex Mavis 350 Badminton Shuttle", sku: "YN-MS-350", selling_price: 1099, cost_price: 650, stock_quantity: 40, low_stock_threshold: 10, category: "Badminton" },
    { name: "Cosco Volleyball - Size 5", sku: "CS-VB-005", selling_price: 1299, cost_price: 750, stock_quantity: 18, low_stock_threshold: 5, category: "Volleyball" },
    { name: "Nivia Football - Storm", sku: "NV-FB-007", selling_price: 1499, cost_price: 850, stock_quantity: 22, low_stock_threshold: 5, category: "Football" },
    { name: "Puma Training Jersey", sku: "PM-TJ-014", selling_price: 1799, cost_price: 900, stock_quantity: 35, low_stock_threshold: 8, category: "Apparel" },
    { name: "Wilson Tennis Racket - Pro Staff", sku: "WL-TR-088", selling_price: 12500, cost_price: 7800, stock_quantity: 6, low_stock_threshold: 2, category: "Tennis" },
    { name: "Reebok Gym Bag - 40L", sku: "RB-GB-040", selling_price: 1899, cost_price: 980, stock_quantity: 28, low_stock_threshold: 7, category: "Accessories" },
    { name: "MRF Batting Gloves - Legend", sku: "MR-BG-021", selling_price: 2199, cost_price: 1200, stock_quantity: 15, low_stock_threshold: 4, category: "Cricket" },
    { name: "Spalding Basketball - NBA", sku: "SP-BB-NBA", selling_price: 2499, cost_price: 1450, stock_quantity: 4, low_stock_threshold: 5, category: "Basketball" },
    { name: "Decathlon Yoga Mat - 6mm", sku: "DC-YM-006", selling_price: 999, cost_price: 480, stock_quantity: 50, low_stock_threshold: 12, category: "Fitness" },
  ];
  return items.map((p) => ({
    ...p,
    id: uid("prd"),
    qr_code: `JANVI-${p.sku}`,
    is_active: true,
    created_at: nowISO(),
    updated_at: nowISO(),
  }));
};

const seedCustomers = (): Customer[] => [
  { id: uid("cus"), name: "Walk-in Customer", mobile: "0000000000", email: "", address: "Counter Sale", credit_balance: 0, created_at: nowISO(), updated_at: nowISO() },
  { id: uid("cus"), name: "Rahul Sharma", mobile: "9876543210", email: "rahul.sharma@example.com", address: "12, MG Road, Mumbai", credit_balance: 0, created_at: nowISO(), updated_at: nowISO() },
  { id: uid("cus"), name: "Priya Patel", mobile: "9123456780", email: "priya.patel@example.com", address: "Sector 21, Ahmedabad", credit_balance: 0, created_at: nowISO(), updated_at: nowISO() },
  { id: uid("cus"), name: "Sports Academy - Pune", mobile: "9988776655", email: "puneacademy@example.com", address: "Karve Nagar, Pune", credit_balance: 0, created_at: nowISO(), updated_at: nowISO() },
];

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      users: seedUsers(),
      customers: [],
      products: [],
      inventoryTransactions: [],
      invoices: [],
      invoiceItems: [],
      salesReturns: [],
      salesReturnItems: [],
      ledger: [],
      collectionSessions: [],
      collectionRows: [],
      initialized: false,
      syncReady: false,

      createUser: async (input) => {
        const normalizedEmail = normalizeEmail(input.email);
        if (!input.name.trim()) return { ok: false, message: "Name is required" };
        if (!normalizedEmail) return { ok: false, message: "Email is required" };
        if (!input.password_hash.trim()) return { ok: false, message: "Password is required" };
        const existing = get().users.find((u) => normalizeEmail(u.email) === normalizedEmail);
        if (existing) return { ok: false, message: "A user with this email already exists" };
        let firebaseUid = uid("user");
        try {
          firebaseUid = await createSecondaryAuthUser(normalizedEmail, input.password_hash);
        } catch {
          return { ok: false, message: "Could not create Firebase login for this user" };
        }
        const user: User = {
          ...input,
          id: firebaseUid,
          email: normalizedEmail,
          mobile: input.mobile?.trim() ?? "",
          permissions: input.permissions ?? [],
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        await setDoc(userProfileRef(firebaseUid), user, { merge: true });
        set((s) => ({ users: [user, ...s.users] }));
        return { ok: true, message: "User created successfully", user };
      },
      updateUser: (id, patch) => {
        const target = get().users.find((u) => u.id === id);
        if (!target) return { ok: false, message: "User not found" };
        if (patch.email !== undefined) {
          const normalizedEmail = normalizeEmail(patch.email);
          if (!normalizedEmail) return { ok: false, message: "Email is required" };
          const duplicate = get().users.find((u) => u.id !== id && normalizeEmail(u.email) === normalizedEmail);
          if (duplicate) return { ok: false, message: "A user with this email already exists" };
        }
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch, email: normalizeEmail(patch.email) || u.email, mobile: patch.mobile ?? u.mobile, updated_at: nowISO() } : u)),
        }));
        return { ok: true, message: "User updated successfully" };
      },
      deleteUser: (id) => {
        const target = get().users.find((u) => u.id === id);
        if (!target) return { ok: false, message: "User not found" };
        if (target.role === "admin") return { ok: false, message: "Admin account cannot be deleted" };
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
        return { ok: true, message: "User deleted successfully" };
      },
      setUserPermissions: (id, permissions) => {
        const target = get().users.find((u) => u.id === id);
        if (!target) return { ok: false, message: "User not found" };
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, permissions, updated_at: nowISO() } : u)),
        }));
        return { ok: true, message: "Permissions updated successfully" };
      },

      seed: () => {
        const state = get();
        if (state.initialized) return;
        set({
          customers: seedCustomers(),
          products: seedProducts(),
          initialized: true,
        });
      },

      resetAll: () => {
        set({
          users: seedUsers(),
          customers: seedCustomers(),
          products: seedProducts(),
          inventoryTransactions: [],
          invoices: [],
          invoiceItems: [],
          salesReturns: [],
          salesReturnItems: [],
          ledger: [],
          collectionSessions: [],
          collectionRows: [],
          initialized: true,
        });
      },

      addCustomer: (data) => {
        const c: Customer = {
          ...data,
          id: uid("cus"),
          credit_balance: data.credit_balance ?? 0,
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        set((s) => ({ customers: [c, ...s.customers] }));
        return c;
      },
      updateCustomer: (id, patch) =>
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === id ? { ...c, ...patch, updated_at: nowISO() } : c
          ),
        })),
      deleteCustomer: (id) =>
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      addProduct: (data) => {
        const p: Product = {
          ...data,
          id: uid("prd"),
          qr_code: data.qr_code || `JANVI-${data.sku}`,
          is_active: data.is_active ?? true,
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        set((s) => ({ products: [p, ...s.products] }));
        return p;
      },
      updateProduct: (id, patch) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, ...patch, updated_at: nowISO() } : p
          ),
        })),
      deleteProduct: (id) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, is_active: false, updated_at: nowISO() } : p
          ),
        })),

      addStock: (productId, qty, note) => {
        const state = get();
        const product = state.products.find((p) => p.id === productId);
        if (!product) return { ok: false, message: "Product not found" };
        if (qty <= 0) return { ok: false, message: "Quantity must be positive" };
        const previous = product.stock_quantity;
        const next = previous + qty;
        const tx: InventoryTransaction = {
          id: uid("itx"),
          product_id: productId,
          type: "ADD",
          quantity: qty,
          previous_stock: previous,
          new_stock: next,
          reference_type: "MANUAL",
          reference_id: "",
          note,
          created_by: useAuth.getState().user?.id || "system",
          created_at: nowISO(),
        };
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, stock_quantity: next, updated_at: nowISO() } : p
          ),
          inventoryTransactions: [tx, ...s.inventoryTransactions],
        }));
        return { ok: true, message: `Added ${qty} units. New stock: ${next}` };
      },
      removeStock: (productId, qty, note) => {
        const state = get();
        const product = state.products.find((p) => p.id === productId);
        if (!product) return { ok: false, message: "Product not found" };
        if (qty <= 0) return { ok: false, message: "Quantity must be positive" };
        if (product.stock_quantity < qty)
          return { ok: false, message: `Insufficient stock. Available: ${product.stock_quantity}` };
        const previous = product.stock_quantity;
        const next = previous - qty;
        const tx: InventoryTransaction = {
          id: uid("itx"),
          product_id: productId,
          type: "REMOVE",
          quantity: qty,
          previous_stock: previous,
          new_stock: next,
          reference_type: "MANUAL",
          reference_id: "",
          note,
          created_by: useAuth.getState().user?.id || "system",
          created_at: nowISO(),
        };
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, stock_quantity: next, updated_at: nowISO() } : p
          ),
          inventoryTransactions: [tx, ...s.inventoryTransactions],
        }));
        return { ok: true, message: `Removed ${qty} units. New stock: ${next}` };
      },

      createInvoice: ({ customer_id, items, discount, amount_paid, created_by }) => {
        const state = get();
        if (items.length === 0) return { ok: false, message: "Cart is empty" };

        // Validate all products and stock (transaction simulation)
        for (const it of items) {
          const p = state.products.find((x) => x.id === it.product_id);
          if (!p || !p.is_active) return { ok: false, message: "Invalid product in cart" };
          if (it.quantity <= 0) return { ok: false, message: "Invalid quantity" };
          if (p.stock_quantity < it.quantity)
            return {
              ok: false,
              message: `Insufficient stock for ${p.name}. Available: ${p.stock_quantity}`,
            };
        }

        const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        const grand_total = Math.max(0, subtotal - discount);
        const balance = Math.max(0, grand_total - amount_paid);
        const status: Invoice["status"] =
          amount_paid >= grand_total ? "PAID" : amount_paid > 0 ? "PARTIAL" : "UNPAID";

        const invoice_id = uid("inv");
        const invoice_number = `INV-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(5, "0")}`;
        const invoice: Invoice = {
          id: invoice_id,
          invoice_number,
          customer_id,
          subtotal,
          discount,
          grand_total,
          amount_paid,
          balance_amount: balance,
          status,
          created_by,
          created_at: nowISO(),
        };

        const newInvoiceItems: InvoiceItem[] = [];
        const newInvTx: InventoryTransaction[] = [];
        const newProducts = [...state.products];

        for (const it of items) {
          const idx = newProducts.findIndex((p) => p.id === it.product_id);
          const p = newProducts[idx];
          const item: InvoiceItem = {
            id: uid("inv_itm"),
            invoice_id,
            product_id: it.product_id,
            product_name: p.name,
            sku: p.sku,
            quantity: it.quantity,
            unit_price: it.unit_price,
            cost_price: p.cost_price,
            total: it.quantity * it.unit_price,
          };
          newInvoiceItems.push(item);
          const prev = p.stock_quantity;
          newProducts[idx] = { ...p, stock_quantity: prev - it.quantity, updated_at: nowISO() };
          newInvTx.push({
            id: uid("itx"),
            product_id: it.product_id,
            type: "SALE",
            quantity: it.quantity,
            previous_stock: prev,
            new_stock: prev - it.quantity,
            reference_type: "INVOICE",
            reference_id: invoice_id,
            created_by,
            created_at: nowISO(),
          });
        }

        // Ledger: SALE entry (debit) + PAYMENT entry if paid
        const customer = state.customers.find((c) => c.id === customer_id);
        const prevBalance = customer?.credit_balance ?? 0;
        const ledgerEntries: CustomerLedgerEntry[] = [];
        ledgerEntries.push({
          id: uid("led"),
          customer_id,
          entry_type: "SALE",
          reference_type: "INVOICE",
          reference_id: invoice_id,
          reference_number: invoice_number,
          debit: grand_total,
          credit: 0,
          balance_after: prevBalance + grand_total,
          created_at: nowISO(),
        });
        if (amount_paid > 0) {
          ledgerEntries.push({
            id: uid("led"),
            customer_id,
            entry_type: "PAYMENT",
            reference_type: "INVOICE",
            reference_id: invoice_id,
            reference_number: invoice_number,
            debit: 0,
            credit: amount_paid,
            balance_after: prevBalance + grand_total - amount_paid,
            created_at: nowISO(),
          });
        }
        const finalBalance = prevBalance + grand_total - amount_paid;

        set((s) => ({
          invoices: [invoice, ...s.invoices],
          invoiceItems: [...newInvoiceItems, ...s.invoiceItems],
          products: newProducts,
          inventoryTransactions: [...newInvTx, ...s.inventoryTransactions],
          customers: s.customers.map((c) =>
            c.id === customer_id ? { ...c, credit_balance: finalBalance, updated_at: nowISO() } : c
          ),
          ledger: [...ledgerEntries, ...s.ledger],
        }));

        return { ok: true, message: "Invoice created", invoice };
      },

      createReturn: ({ invoice_id, items, reason, created_by }) => {
        const state = get();
        const invoice = state.invoices.find((i) => i.id === invoice_id);
        if (!invoice) return { ok: false, message: "Invoice not found" };
        if (items.length === 0) return { ok: false, message: "No items selected" };

        // Validate each item
        const returnItems: SalesReturnItem[] = [];
        let total = 0;
        const newInvTx: InventoryTransaction[] = [];
        const newProducts = [...state.products];
        const newReturnItems = [...state.salesReturnItems];

        for (const it of items) {
          const invItem = state.invoiceItems.find(
            (ii) => ii.invoice_id === invoice_id && ii.id === it.invoice_item_id
          );
          if (!invItem) return { ok: false, message: "Invalid invoice item" };
          const alreadyReturned = state.salesReturnItems
            .filter((r) => r.invoice_item_id === invItem.id)
            .reduce((s, r) => s + r.quantity, 0);
          const available = invItem.quantity - alreadyReturned;
          if (it.quantity <= 0 || it.quantity > available)
            return {
              ok: false,
              message: `Invalid quantity for ${invItem.product_name}. Returnable: ${available}`,
            };

          const idx = newProducts.findIndex((p) => p.id === invItem.product_id);
          if (idx >= 0) {
            const p = newProducts[idx];
            const prev = p.stock_quantity;
            newProducts[idx] = { ...p, stock_quantity: prev + it.quantity, updated_at: nowISO() };
            newInvTx.push({
              id: uid("itx"),
              product_id: invItem.product_id,
              type: "RETURN",
              quantity: it.quantity,
              previous_stock: prev,
              new_stock: prev + it.quantity,
              reference_type: "RETURN",
              reference_id: "",
              created_by,
              created_at: nowISO(),
            });
          }

          const amt = it.quantity * invItem.unit_price;
          total += amt;
          const rid = uid("ret_itm");
          returnItems.push({
            id: rid,
            sales_return_id: "",
            invoice_item_id: invItem.id,
            product_id: invItem.product_id,
            product_name: invItem.product_name,
            quantity: it.quantity,
            unit_price: invItem.unit_price,
            amount: amt,
          });
        }

        const return_id = uid("ret");
        const return_number = `RET-${new Date().getFullYear()}-${String(state.salesReturns.length + 1).padStart(5, "0")}`;
        const salesReturn: SalesReturn = {
          id: return_id,
          return_number,
          invoice_id,
          invoice_number: invoice.invoice_number,
          customer_id: invoice.customer_id,
          total_amount: total,
          items_count: items.reduce((s, i) => s + i.quantity, 0),
          reason,
          created_by,
          created_at: nowISO(),
        };
        const finalized = returnItems.map((r) => ({ ...r, sales_return_id: return_id }));

        // Ledger: RETURN entry reduces balance
        const customer = state.customers.find((c) => c.id === invoice.customer_id);
        const prevBal = customer?.credit_balance ?? 0;
        const newBal = Math.max(0, prevBal - total);
        const ledgerEntries: CustomerLedgerEntry[] = [
          {
            id: uid("led"),
            customer_id: invoice.customer_id,
            entry_type: "RETURN",
            reference_type: "RETURN",
            reference_id: return_id,
            reference_number: return_number,
            debit: 0,
            credit: total,
            balance_after: newBal,
            created_at: nowISO(),
          },
        ];

        set((s) => ({
          salesReturns: [salesReturn, ...s.salesReturns],
          salesReturnItems: [...finalized, ...newReturnItems],
          products: newProducts,
          inventoryTransactions: [...newInvTx, ...s.inventoryTransactions],
          customers: s.customers.map((c) =>
            c.id === invoice.customer_id ? { ...c, credit_balance: newBal, updated_at: nowISO() } : c
          ),
          ledger: [...ledgerEntries, ...s.ledger],
        }));

        return { ok: true, message: "Return processed", salesReturn };
      },

      recordPayment: (customer_id, amount, created_by, note) => {
        if (amount <= 0) return { ok: false, message: "Amount must be positive" };
        const state = get();
        const customer = state.customers.find((c) => c.id === customer_id);
        if (!customer) return { ok: false, message: "Customer not found" };
        const newBal = Math.max(0, customer.credit_balance - amount);
        const entry: CustomerLedgerEntry = {
          id: uid("led"),
          customer_id,
          entry_type: "PAYMENT",
          reference_type: "MANUAL",
          reference_id: "",
          debit: 0,
          credit: amount,
          balance_after: newBal,
          note,
          created_by,
          created_at: nowISO(),
        };
        set((s) => ({
          customers: s.customers.map((c) =>
            c.id === customer_id ? { ...c, credit_balance: newBal, updated_at: nowISO() } : c
          ),
          ledger: [entry, ...s.ledger],
        }));
        return { ok: true, message: "Payment recorded" };
      },

      // ===== Daily Collection Pro =====
      createCollectionSession: ({ title, collection_date, names_raw, created_by }) => {
        const lines = names_raw
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        const dedup = Array.from(new Map(lines.map((n) => [n.toLowerCase(), n])).values());
        if (dedup.length === 0) return { ok: false, message: "Please paste at least one client name" };

        const state = get();
        const session_id = uid("dcol");
        const dateStr = collection_date || new Date().toISOString().slice(0, 10);
        const session_number = `DC-${dateStr.replace(/-/g, "")}-${String(state.collectionSessions.length + 1).padStart(3, "0")}`;
        const session: CollectionSession = {
          id: session_id,
          session_number,
          collection_date: dateStr,
          title: title || `Daily Collection – ${dateStr}`,
          total_clients: dedup.length,
          paid_clients: 0,
          pending_clients: dedup.length,
          total_collected: 0,
          pending_amount: 0,
          status: "OPEN",
          created_by,
          created_at: nowISO(),
          updated_at: nowISO(),
        };

        const rows: CollectionRow[] = dedup.map((name, idx) => {
          // Try to link to existing ERP customer
          const customer = state.customers.find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          );
          return {
            id: uid("dcr"),
            session_id,
            serial: idx + 1,
            customer_id: customer?.id,
            customer_name: name,
            customer_mobile: customer?.mobile,
            amount_expected: customer?.credit_balance || undefined,
            amount_received: 0,
            status: "UNPAID",
            updated_at: nowISO(),
          };
        });

        set((s) => ({
          collectionSessions: [session, ...s.collectionSessions],
          collectionRows: [...rows, ...s.collectionRows],
        }));
        return { ok: true, session_id, message: `Created collection sheet with ${dedup.length} clients` };
      },

      updateCollectionRow: (row_id, patch) => {
        set((s) => {
          const rows = s.collectionRows.map((r) =>
            r.id === row_id ? { ...r, ...patch, updated_at: nowISO() } : r
          );
          // Recalc session totals only for affected session
          const updatedRow = rows.find(r => r.id === row_id);
          const affectedSessionId = updatedRow?.session_id;
          
          const sessions = s.collectionSessions.map((sess) => {
            if (sess.id !== affectedSessionId) return sess; // Don't update unaffected sessions
            
            const sessRows = rows.filter((r) => r.session_id === sess.id);
            if (sessRows.length === 0) return sess;
            
            const paid_clients = sessRows.filter((r) => r.status === "PAID").length;
            const pending_clients = sessRows.filter((r) => r.status === "PENDING" || r.status === "UNPAID").length;
            const total_collected = sessRows.reduce((sum, r) => sum + (r.amount_received || 0), 0);
            
            // Only update if values changed
            if (sess.paid_clients === paid_clients && sess.pending_clients === pending_clients && sess.total_collected === total_collected && sess.total_clients === sessRows.length) {
              return sess;
            }
            
            return {
              ...sess,
              total_clients: sessRows.length,
              paid_clients,
              pending_clients,
              total_collected,
              updated_at: nowISO(),
            };
          });
          return { collectionRows: rows, collectionSessions: sessions };
        });
      },

      setCollectionRowPayment: (row_id, amount, status, due_date, notes) => {
        const state = get();
        const row = state.collectionRows.find(r => r.id === row_id);
        if (!row) return;
        const sess = state.collectionSessions.find(s => s.id === row.session_id);
        if (sess?.status === "LOCKED") return;
        get().updateCollectionRow(row_id, {
          amount_received: Math.max(0, Number(amount) || 0),
          status,
          due_date: due_date || undefined,
          notes: notes || undefined,
          collected_at: status === "PAID" ? nowISO() : undefined,
          collected_by: useAuth.getState().user?.id,
        });
      },

      addCollectionRow: (session_id, customer_name) => {
        const state = get();
        const sess = state.collectionSessions.find(s => s.id === session_id);
        if (!sess || sess.status === "LOCKED") return;
        const existing = state.collectionRows.filter(r => r.session_id === session_id);
        const customer = state.customers.find(c => c.name.toLowerCase() === customer_name.toLowerCase());
        const row: CollectionRow = {
          id: uid("dcr"),
          session_id,
          serial: existing.length + 1,
          customer_id: customer?.id,
          customer_name,
          customer_mobile: customer?.mobile,
          amount_expected: customer?.credit_balance || undefined,
          amount_received: 0,
          status: "UNPAID",
          updated_at: nowISO(),
        };
        set((s) => {
          const newRows = [row, ...s.collectionRows];
          const sessions = s.collectionSessions.map(cs => cs.id === session_id ? { ...cs, total_clients: cs.total_clients + 1, pending_clients: cs.pending_clients + 1, updated_at: nowISO() } : cs);
          return { collectionRows: newRows, collectionSessions: sessions };
        });
      },

      deleteCollectionRow: (row_id) => {
        const state = get();
        const row = state.collectionRows.find(r => r.id === row_id);
        if (!row) return;
        const sess = state.collectionSessions.find(s => s.id === row.session_id);
        if (sess?.status === "LOCKED") return;
        set((s) => {
          const newRows = s.collectionRows.filter(r => r.id !== row_id);
          const rowsAfter = newRows.filter(r => r.session_id === row.session_id);
          const paid_clients = rowsAfter.filter(r => r.status === "PAID").length;
          const pending_clients = rowsAfter.filter(r => r.status === "PENDING" || r.status === "UNPAID").length;
          const total_collected = rowsAfter.reduce((sum, r) => sum + (r.amount_received || 0), 0);
          return {
            collectionRows: newRows,
            collectionSessions: s.collectionSessions.map(cs => {
              if (cs.id !== row.session_id) return cs;
              return { ...cs, total_clients: rowsAfter.length, paid_clients, pending_clients, total_collected, updated_at: nowISO() };
            })
          };
        });
      },

      reorderCollectionRows: (session_id, row_ids) => {
        set((s) => {
          const rows = [...s.collectionRows];
          row_ids.forEach((id, index) => {
            const ri = rows.findIndex(r => r.id === id && r.session_id === session_id);
            if (ri >= 0) rows[ri] = { ...rows[ri], serial: index + 1, updated_at: nowISO() };
          });
          return { collectionRows: rows };
        });
      },

      lockCollectionSession: (session_id) => {
        const state = get();
        const sess = state.collectionSessions.find(s => s.id === session_id);
        if (!sess) return { ok: false, message: "Session not found" };
        if (sess.status === "LOCKED") return { ok: false, message: "Already locked" };
        set((s) => ({
          collectionSessions: s.collectionSessions.map(cs => cs.id === session_id ? { ...cs, status: "LOCKED", locked_at: nowISO(), updated_at: nowISO() } : cs)
        }));
        return { ok: true, message: "Collection locked and saved" };
      },

      unlockCollectionSession: (session_id) => {
        set((s) => ({
          collectionSessions: s.collectionSessions.map(cs => cs.id === session_id ? { ...cs, status: "OPEN", locked_at: undefined, updated_at: nowISO() } : cs)
        }));
      },

      deleteCollectionSession: (session_id) => {
        set((s) => ({
          collectionSessions: s.collectionSessions.filter(cs => cs.id !== session_id),
          collectionRows: s.collectionRows.filter(r => r.session_id !== session_id)
        }));
      },

      postCollectionToLedger: (session_id) => {
        const state = get();
        const sess = state.collectionSessions.find(s => s.id === session_id);
        if (!sess) return { ok: false, posted: 0, message: "Session not found" };
        const rows = state.collectionRows.filter(r => r.session_id === session_id && r.status === "PAID" && r.amount_received > 0 && r.customer_id);
        let posted = 0;
        for (const row of rows) {
          if (!row.customer_id) continue;
          const res = get().recordPayment(row.customer_id, row.amount_received, useAuth.getState().user?.id || "collection", `Daily Collection ${sess.session_number} – ${row.customer_name}`);
          if (res.ok) posted++;
        }
        return { ok: true, posted, message: `Posted ${posted} payments to ERP customer ledger` };
      },

    }),
    {
      name: "janvi-data",
      partialize: (s) => ({
        users: s.users,
        customers: s.customers,
        products: s.products,
        inventoryTransactions: s.inventoryTransactions,
        invoices: s.invoices,
        invoiceItems: s.invoiceItems,
        salesReturns: s.salesReturns,
        salesReturnItems: s.salesReturnItems,
        ledger: s.ledger,
        collectionSessions: s.collectionSessions,
        collectionRows: s.collectionRows,
        initialized: s.initialized,
      }),
    }
  )
);

type PersistedDataState = Pick<
  DataState,
  | "users"
  | "customers"
  | "products"
  | "inventoryTransactions"
  | "invoices"
  | "invoiceItems"
  | "salesReturns"
  | "salesReturnItems"
  | "ledger"
  | "collectionSessions"
  | "collectionRows"
  | "initialized"
>;

const persistedDataKeys: (keyof PersistedDataState)[] = [
  "users",
  "customers",
  "products",
  "inventoryTransactions",
  "invoices",
  "invoiceItems",
  "salesReturns",
  "salesReturnItems",
  "ledger",
  "collectionSessions",
  "collectionRows",
  "initialized",
];

const getPersistedDataSnapshot = (state: DataState): PersistedDataState => ({
  users: state.users,
  customers: state.customers,
  products: state.products,
  inventoryTransactions: state.inventoryTransactions,
  invoices: state.invoices,
  invoiceItems: state.invoiceItems,
  salesReturns: state.salesReturns,
  salesReturnItems: state.salesReturnItems,
  ledger: state.ledger,
  collectionSessions: state.collectionSessions,
  collectionRows: state.collectionRows,
  initialized: state.initialized,
});

const samePersistedData = (left: PersistedDataState, right: PersistedDataState) =>
  persistedDataKeys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));

let firebaseStarted = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemoteData = false;
let cloudReady = false;
let lastCloudData: PersistedDataState | null = null;

const toPersistedDataState = (cloudState: Partial<PersistedDataState>): PersistedDataState => ({
  users: cloudState.users?.length ? cloudState.users : useData.getState().users,
  customers: cloudState.customers ?? [],
  products: cloudState.products ?? [],
  inventoryTransactions: cloudState.inventoryTransactions ?? [],
  invoices: cloudState.invoices ?? [],
  invoiceItems: cloudState.invoiceItems ?? [],
  salesReturns: cloudState.salesReturns ?? [],
  salesReturnItems: cloudState.salesReturnItems ?? [],
  ledger: cloudState.ledger ?? [],
  collectionSessions: cloudState.collectionSessions ?? [],
  collectionRows: cloudState.collectionRows ?? [],
  initialized: cloudState.initialized ?? true,
});

const queueCloudSave = (state: DataState) => {
  if (!cloudReady || applyingRemoteData) return;
  const data = getPersistedDataSnapshot(state);
  if (lastCloudData && samePersistedData(data, lastCloudData)) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const latestData = getPersistedDataSnapshot(useData.getState());
    if (lastCloudData && samePersistedData(latestData, lastCloudData)) return;
    void setDoc(appStateRef(), { ...latestData, updated_at: nowISO() }, { merge: true }).then(() => {
      lastCloudData = latestData;
    });
  }, 100);
};

export const initializeFirebaseBackend = () => {
  if (firebaseStarted) return;
  firebaseStarted = true;

  onFirebaseAuthChanged(async (firebaseUser) => {
    if (!firebaseUser) {
      useAuth.setState({ user: null, authReady: true });
      return;
    }

    try {
      const profile = await ensureUserProfile(firebaseUser);
      useAuth.setState({ user: normalizeStoredUser(profile), authReady: true });
      const users = useData.getState().users;
      if (!users.some((user) => user.id === profile.id)) {
        useData.setState({ users: [profile, ...users] });
      }
    } catch {
      useAuth.setState({ user: null, authReady: true });
    }
  });

  getDoc(appStateRef())
    .then((snapshot) => {
      if (snapshot.exists()) {
        const nextState = toPersistedDataState(snapshot.data() as Partial<PersistedDataState>);
        lastCloudData = nextState;
        applyingRemoteData = true;
        useData.setState(nextState);
        applyingRemoteData = false;
      } else {
        lastCloudData = getPersistedDataSnapshot(useData.getState());
        void setDoc(appStateRef(), { ...lastCloudData, updated_at: nowISO() }, { merge: true });
      }

      cloudReady = true;
      useData.setState({ syncReady: true });
      useData.subscribe(queueCloudSave);
    })
    .catch(() => {
      cloudReady = true;
      useData.setState({ syncReady: true });
    });

  onSnapshot(appStateRef(), (snapshot) => {
    if (!snapshot.exists()) return;
    if (!cloudReady) return;
    const nextState = toPersistedDataState(snapshot.data() as Partial<PersistedDataState>);
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    lastCloudData = nextState;
    if (samePersistedData(getPersistedDataSnapshot(useData.getState()), nextState)) return;
    applyingRemoteData = true;
    useData.setState(nextState);
    applyingRemoteData = false;
  });
};
