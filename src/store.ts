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
import {
  appStateRef,
  createSecondaryAuthUser,
  db,
  ensureUserProfile,
  logoutFirebase,
  onFirebaseAuthChanged,
  signInOrBootstrapUser,
  uploadCashCollectionPDF,
  userProfileRef,
} from "./firebase";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";

type AuthState = {
  user: User | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
};

const normalizeEmail = (value?: string | null) => (value ?? "").trim().toLowerCase();

const normalizeStoredUser = (user: User | null | undefined): User | null => {
  if (!user) return null;

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
          const user = await signInOrBootstrapUser(normalizedEmail, password);
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
  cash_last_synced_at: string | null;

  initialized: boolean;
  syncReady: boolean;
  cashCollectionsReady: boolean;

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
  uploadCollectionSessionPDF: (session_id: string, pdfBlob: Blob) => Promise<{ ok: boolean; message: string; url?: string }>;
  postCollectionToLedger: (session_id: string) => { ok: boolean; posted: number; message: string };

  // Users / RBAC
  createUser: (input: Omit<User, "id" | "created_at" | "updated_at">) => Promise<{ ok: boolean; message: string; user?: User }>;
  updateUser: (id: string, patch: Partial<User>) => { ok: boolean; message: string };
  deleteUser: (id: string) => { ok: boolean; message: string };
  setUserPermissions: (id: string, permissions: PermissionKey[]) => { ok: boolean; message: string };

};

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      users: [],
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
      cash_last_synced_at: null,
      initialized: true,
      syncReady: false,
      cashCollectionsReady: false,

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
          products: s.products.filter((p) => p.id !== id),
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
          const customer = state.customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
          return {
            id: uid("dcr"),
            session_id,
            serial: idx + 1,
            customer_id: customer?.id,
            customer_name: name,
            customer_mobile: customer?.mobile ?? null,
            amount_expected: customer?.credit_balance ?? null,
            amount_received: 0,
            status: "UNPAID",
            updated_at: nowISO(),
          };
        });

        set((s) => ({
          collectionSessions: [session, ...s.collectionSessions],
          collectionRows: [...rows, ...s.collectionRows],
        }));

        if (canWriteCashCollection()) {
          void Promise.all([writeCashCollectionSession(session), ...rows.map(writeCashCollectionRow)]).catch((err) => {
            console.error("[janvi] createCollectionSession initial cloud write failed", err);
            try {
              enqueuePendingWrite(`cashCollectionSessions/${session.id}`, sanitize(session as any));
              rows.forEach((row) => enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any)));
              scheduleFlushPendingWrites(2000);
            } catch (enqueueError) {
              console.error("[janvi] enqueue pending createCollectionSession failed", enqueueError);
            }
          });
        } else {
          try {
            enqueuePendingWrite(`cashCollectionSessions/${session.id}`, sanitize(session as any));
            rows.forEach((row) => enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any)));
            scheduleFlushPendingWrites(2000);
          } catch (enqueueError) {
            console.error("[janvi] enqueue pending createCollectionSession failed", enqueueError);
          }
        }

        saveCloudNow();
        return { ok: true, session_id, message: `Created collection sheet with ${dedup.length} clients` };
      },

      updateCollectionRow: (row_id, patch) => {
        set((s) => {
          const rows = s.collectionRows.map((r) =>
            r.id === row_id ? { ...r, ...patch, updated_at: nowISO() } : r
          );
          const updatedRow = rows.find((r) => r.id === row_id);
          const affectedSessionId = updatedRow?.session_id;
          const sessions = s.collectionSessions.map((sess) => {
            if (sess.id !== affectedSessionId) return sess;
            const sessRows = rows.filter((r) => r.session_id === sess.id);
            if (sessRows.length === 0) return sess;
            const paid_clients = sessRows.filter((r) => r.status === "PAID").length;
            const pending_clients = sessRows.filter((r) => r.status === "PENDING" || r.status === "UNPAID").length;
            const total_collected = sessRows.reduce((sum, r) => sum + (r.amount_received || 0), 0);
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

        const updatedRow = get().collectionRows.find((r) => r.id === row_id);
        const affectedSession = updatedRow ? get().collectionSessions.find((s) => s.id === updatedRow.session_id) : undefined;
        if (updatedRow) void writeCashCollectionRow(updatedRow).catch((err) => {
          console.error("[janvi] updateCollectionRow failed", err);
          enqueuePendingWrite(`cashCollectionRows/${updatedRow.id}`, sanitize(updatedRow as any));
          scheduleFlushPendingWrites(2000);
        });
        if (affectedSession) void writeCashCollectionSession(affectedSession).catch((err) => {
          console.error("[janvi] updateCollectionRow session update failed", err);
          enqueuePendingWrite(`cashCollectionSessions/${affectedSession.id}`, sanitize(affectedSession as any));
          scheduleFlushPendingWrites(2000);
        });

        saveCloudNow();
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
          customer_mobile: customer?.mobile ?? null,
          amount_expected: customer?.credit_balance ?? null,
          amount_received: 0,
          status: "UNPAID",
          updated_at: nowISO(),
        };
        set((s) => {
          const newRows = [row, ...s.collectionRows];
          const sessions = s.collectionSessions.map(cs => cs.id === session_id ? { ...cs, total_clients: cs.total_clients + 1, pending_clients: cs.pending_clients + 1, updated_at: nowISO() } : cs);
          return { collectionRows: newRows, collectionSessions: sessions };
        });

        if (canWriteCashCollection()) {
          const updatedSession = get().collectionSessions.find((s) => s.id === session_id);
          if (updatedSession) void writeCashCollectionSession(updatedSession).catch((err) => {
            console.error("[janvi] addCollectionRow session update failed", err);
            enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
            scheduleFlushPendingWrites(2000);
          });
          void writeCashCollectionRow(row).catch((err) => {
            console.error("[janvi] addCollectionRow failed", err);
            enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any));
            scheduleFlushPendingWrites(2000);
          });
        } else {
          enqueuePendingWrite(`cashCollectionSessions/${session_id}`, sanitize(get().collectionSessions.find((s) => s.id === session_id) as any));
          enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any));
          scheduleFlushPendingWrites(2000);
        }

        saveCloudNow();
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

        if (canWriteCashCollection()) {
          void deleteCashCollectionRow(row_id).catch((err) => {
            console.error("[janvi] deleteCollectionRow failed", err);
            enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any));
            scheduleFlushPendingWrites(2000);
          });
        } else {
          enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any));
          scheduleFlushPendingWrites(2000);
        }

        const updatedSession = get().collectionSessions.find((s) => s.id === row.session_id);
        if (updatedSession) {
          if (canWriteCashCollection()) {
            void writeCashCollectionSession(updatedSession).catch((err) => {
              console.error("[janvi] deleteCollectionRow session update failed", err);
              enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
              scheduleFlushPendingWrites(2000);
            });
          } else {
            enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
            scheduleFlushPendingWrites(2000);
          }
        }

        saveCloudNow();
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

        const rows = get().collectionRows.filter((r) => r.session_id === session_id);
        rows.forEach((row) => {
          if (canWriteCashCollection()) {
            void writeCashCollectionRow(row).catch((err) => {
              console.error("[janvi] reorderCollectionRows failed", err);
              enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any));
              scheduleFlushPendingWrites(2000);
            });
          } else {
            enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any));
          }
        });

        saveCloudNow();
      },

      lockCollectionSession: (session_id) => {
        const state = get();
        const sess = state.collectionSessions.find(s => s.id === session_id);
        if (!sess) return { ok: false, message: "Session not found" };
        if (sess.status === "LOCKED") return { ok: false, message: "Already locked" };
        const updatedSession = { ...sess, status: "LOCKED", locked_at: nowISO(), updated_at: nowISO() };
        set((s) => ({
          collectionSessions: s.collectionSessions.map(cs => cs.id === session_id ? updatedSession : cs)
        }));

        if (canWriteCashCollection()) {
          void writeCashCollectionSession(updatedSession).catch((err) => {
            console.error("[janvi] lockCollectionSession failed", err);
            enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
            scheduleFlushPendingWrites(2000);
          });
        } else {
          enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
          scheduleFlushPendingWrites(2000);
        }

        saveCloudNow();
        return { ok: true, message: "Collection locked and saved" };
      },

      unlockCollectionSession: (session_id) => {
        const session = get().collectionSessions.find((cs) => cs.id === session_id);
        if (!session) return;
        const updatedSession = { ...session, status: "OPEN", locked_at: undefined, updated_at: nowISO() };
        set((s) => ({
          collectionSessions: s.collectionSessions.map(cs => cs.id === session_id ? updatedSession : cs)
        }));

        if (canWriteCashCollection()) {
          void writeCashCollectionSession(updatedSession).catch((err) => {
            console.error("[janvi] unlockCollectionSession failed", err);
            enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
            scheduleFlushPendingWrites(2000);
          });
        } else {
          enqueuePendingWrite(`cashCollectionSessions/${updatedSession.id}`, sanitize(updatedSession as any));
          scheduleFlushPendingWrites(2000);
        }

        saveCloudNow();
      },

      deleteCollectionSession: (session_id) => {
        const rowIds = get().collectionRows.filter((r) => r.session_id === session_id).map((r) => r.id);
        set((s) => ({
          collectionSessions: s.collectionSessions.filter(cs => cs.id !== session_id),
          collectionRows: s.collectionRows.filter(r => r.session_id !== session_id)
        }));

        if (canWriteCashCollection()) {
          void deleteCashCollectionSession(session_id).catch((err) => {
            console.error("[janvi] deleteCollectionSession failed", err);
            enqueuePendingWrite(`cashCollectionSessions/${session_id}`, sanitize({ id: session_id } as any));
            scheduleFlushPendingWrites(2000);
          });
          rowIds.forEach((rowId) => {
            void deleteCashCollectionRow(rowId).catch((err) => {
              console.error("[janvi] deleteCollectionSession row delete failed", err);
              enqueuePendingWrite(`cashCollectionRows/${rowId}`, sanitize({ id: rowId } as any));
              scheduleFlushPendingWrites(2000);
            });
          });
        } else {
          enqueuePendingWrite(`cashCollectionSessions/${session_id}`, sanitize({ id: session_id } as any));
          rowIds.forEach((rowId) => enqueuePendingWrite(`cashCollectionRows/${rowId}`, sanitize({ id: rowId } as any)));
          scheduleFlushPendingWrites(2000);
        }

        saveCloudNow();
      },

      uploadCollectionSessionPDF: async (session_id, pdfBlob) => {
        if (!canWriteCashCollection()) {
          return { ok: false, message: "Sign in before saving PDFs to cloud" };
        }
        const state = get();
        const session = state.collectionSessions.find((s) => s.id === session_id);
        if (!session) return { ok: false, message: "Session not found" };

        try {
          const url = await uploadCashCollectionPDF(session_id, pdfBlob);
          const updatedSession = {
            ...session,
            pdf_url: url,
            pdf_stored_at: nowISO(),
            updated_at: nowISO(),
          };
          set((s) => ({
            collectionSessions: s.collectionSessions.map((cs) =>
              cs.id === session_id ? updatedSession : cs
            ),
          }));
          if (canWriteCashCollection()) {
            await writeCashCollectionSession(updatedSession);
          }
          return { ok: true, message: "PDF saved to cloud.", url };
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                ? error
                : "Failed to upload the PDF",
          };
        }
      },

      postCollectionToLedger: (session_id) => {
        try {
          const state = get();
          const sess = state.collectionSessions.find(s => s.id === session_id);
          if (!sess) return { ok: false, posted: 0, message: "Session not found" };
          const rows = state.collectionRows.filter(
            (r) => r.session_id === session_id && r.status === "PAID" && r.amount_received > 0 && r.customer_id
          );
          let posted = 0;
          for (const row of rows) {
            if (!row.customer_id) continue;
            const res = get().recordPayment(
              row.customer_id,
              row.amount_received,
              useAuth.getState().user?.id || "collection",
              `Daily Collection ${sess.session_number} – ${row.customer_name}`
            );
            if (res.ok) {
              posted++;
            }
          }
          saveCloudNow();
          saveCashCollectionsNow();
          return { ok: true, posted, message: `Posted ${posted} payments to ERP customer ledger` };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === "string"
              ? error
              : "Failed while posting to ERP ledger";
          return { ok: false, posted: 0, message };
        }
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
  initialized: state.initialized,
});

const samePersistedData = (left: PersistedDataState, right: PersistedDataState) =>
  persistedDataKeys.every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));

const sameCashCollections = (
  left: { collectionSessions: CollectionSession[]; collectionRows: CollectionRow[] },
  right: { collectionSessions: CollectionSession[]; collectionRows: CollectionRow[] }
) =>
  JSON.stringify(left.collectionSessions) === JSON.stringify(right.collectionSessions) &&
  JSON.stringify(left.collectionRows) === JSON.stringify(right.collectionRows);

let firebaseStarted = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemoteData = false;
let applyingRemoteCashCollection = false;
let cloudReady = false;
let lastCloudData: PersistedDataState | null = null;
let cashSessionsReady = false;
let cashRowsReady = false;
let cashListenersStarted = false;

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
  initialized: cloudState.initialized ?? true,
});

const queueCloudSave = (state: DataState) => {
  if (!cloudReady || applyingRemoteData || applyingRemoteCashCollection) return;
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

const saveCloudNow = () => {
  if (!cloudReady || applyingRemoteData || applyingRemoteCashCollection) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const latestData = getPersistedDataSnapshot(useData.getState());
  if (lastCloudData && samePersistedData(latestData, lastCloudData)) return;
  setDoc(appStateRef(), { ...latestData, updated_at: nowISO() }, { merge: true })
    .then(() => {
      lastCloudData = latestData;
      console.debug("[janvi] saveCloudNow: wrote app state to Firestore");
    })
    .catch((err) => console.error("[janvi] saveCloudNow failed", err));
};

const cashCollectionSessionDoc = (id: string) => doc(db, "cashCollectionSessions", id);
const cashCollectionRowDoc = (id: string) => doc(db, "cashCollectionRows", id);

const sanitize = (obj: Record<string, any>) => {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    out[k] = v === undefined ? null : v;
  });
  return out;
};

const canWriteCashCollection = () => {
  return !!useAuth.getState().user;
};

const writeCashCollectionSession = async (session: CollectionSession) => {
  if (!canWriteCashCollection()) return;
  return setDoc(cashCollectionSessionDoc(session.id), sanitize(session as any), { merge: true });
};

const writeCashCollectionRow = async (row: CollectionRow) => {
  if (!canWriteCashCollection()) return;
  return setDoc(cashCollectionRowDoc(row.id), sanitize(row as any), { merge: true });
};

const deleteCashCollectionSession = async (session_id: string) => {
  if (!canWriteCashCollection()) return;
  return deleteDoc(cashCollectionSessionDoc(session_id));
};

const deleteCashCollectionRow = async (row_id: string) => {
  if (!canWriteCashCollection()) return;
  return deleteDoc(cashCollectionRowDoc(row_id));
};

const applyRemoteCashCollectionState = (nextSessions?: CollectionSession[], nextRows?: CollectionRow[]) => {
  const current = useData.getState();
  const mergedSessions = nextSessions ?? current.collectionSessions;
  const mergedRows = nextRows ?? current.collectionRows;
  const nextState = {
    collectionSessions: mergedSessions,
    collectionRows: mergedRows,
  };

  if (sameCashCollections({ collectionSessions: current.collectionSessions, collectionRows: current.collectionRows }, nextState)) {
    return;
  }

  applyingRemoteCashCollection = true;
  useData.setState(nextState);
  applyingRemoteCashCollection = false;
};

const markCashCollectionsReady = () => {
  if (cashSessionsReady && cashRowsReady) {
    useData.setState({ cashCollectionsReady: true });
  }
};

const attachCashCollectionListeners = () => {
  if (cashListenersStarted) return;
  cashListenersStarted = true;
  console.debug("[janvi] attachCashCollectionListeners: starting listeners", {
    user: useAuth.getState().user?.id,
    cloudReady,
  });

  onSnapshot(collection(db, "cashCollectionSessions"), (snapshot) => {
    if (snapshot.metadata.hasPendingWrites) return;
    cashSessionsReady = true;
    markCashCollectionsReady();
    const nextSessions = snapshot.docs.map((doc) => {
      const data = doc.data() as CollectionSession;
      return { ...data, id: doc.id };
    });
    console.debug("[janvi] cashCollectionSessions snapshot received", { count: nextSessions.length });
    applyRemoteCashCollectionState(nextSessions);
    try { useData.setState({ cash_last_synced_at: nowISO() }); } catch {}
  }, (error) => {
    console.error("cashCollectionSessions snapshot error", error);
    cashSessionsReady = true;
    markCashCollectionsReady();
  });

  onSnapshot(collection(db, "cashCollectionRows"), (snapshot) => {
    if (snapshot.metadata.hasPendingWrites) return;
    cashRowsReady = true;
    markCashCollectionsReady();
    const nextRows = snapshot.docs.map((doc) => {
      const data = doc.data() as CollectionRow;
      return { ...data, id: doc.id };
    });
    console.debug("[janvi] cashCollectionRows snapshot received", { count: nextRows.length });
    applyRemoteCashCollectionState(undefined, nextRows);
    try { useData.setState({ cash_last_synced_at: nowISO() }); } catch {}
  }, (error) => {
    console.error("cashCollectionRows snapshot error", error);
    cashRowsReady = true;
    markCashCollectionsReady();
  });
};

const saveCashCollectionsNow = () => {
  if (applyingRemoteCashCollection) return;
  const { collectionSessions, collectionRows } = useData.getState();
  if (!canWriteCashCollection()) {
    try {
      collectionSessions.forEach((session) => enqueuePendingWrite(`cashCollectionSessions/${session.id}`, sanitize(session as any)));
      collectionRows.forEach((row) => enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any)));
      scheduleFlushPendingWrites(2000);
    } catch (e) {
      console.error("[janvi] saveCashCollectionsNow enqueue failed", e);
    }
    return;
  }

  const tasks = [
    ...collectionSessions.map((session) => writeCashCollectionSession(session)),
    ...collectionRows.map((row) => writeCashCollectionRow(row)),
  ];

  Promise.all(tasks)
    .then(() => {
      console.debug("[janvi] saveCashCollectionsNow: wrote to Firestore", {
        sessions: collectionSessions.length,
        rows: collectionRows.length,
      });
      try {
        localStorage.setItem(
          "janvi:cash_last_saved_at",
          JSON.stringify({ at: nowISO(), sessions: collectionSessions.length, rows: collectionRows.length })
        );
      } catch {}
    })
    .catch((err) => {
      console.error("[janvi] saveCashCollectionsNow failed", err);
      try {
        localStorage.setItem("janvi:cash_last_save_error", JSON.stringify({ at: nowISO(), message: (err && err.message) || err }));
      } catch {}
      try {
        collectionSessions.forEach((session) => enqueuePendingWrite(`cashCollectionSessions/${session.id}`, sanitize(session as any)));
        collectionRows.forEach((row) => enqueuePendingWrite(`cashCollectionRows/${row.id}`, sanitize(row as any)));
        scheduleFlushPendingWrites(2000);
      } catch (e) {
        console.error("[janvi] enqueue pending writes failed", e);
      }
    });
};

// Pending write queue for cash collections (persisted to localStorage)
const PENDING_KEY = "janvi:pending_cash_writes";
let pendingCashWrites: Array<{ docPath: string; data: Record<string, any> }> = [];

const loadPendingWrites = () => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [] as any[];
    return JSON.parse(raw) as Array<{ docPath: string; data: Record<string, any> }>;
  } catch {
    return [] as any[];
  }
};

const savePendingWritesToStorage = () => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendingCashWrites));
  } catch {}
};

pendingCashWrites = loadPendingWrites();

const enqueuePendingWrite = (docPath: string, data: Record<string, any>) => {
  pendingCashWrites.push({ docPath, data });
  savePendingWritesToStorage();
};

let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleFlushPendingWrites = (delay = 3000) => {
  if (pendingFlushTimer) clearTimeout(pendingFlushTimer);
  pendingFlushTimer = setTimeout(() => void flushPendingCashWrites(), delay);
};

const flushPendingCashWrites = async () => {
  if (!cloudReady || applyingRemoteCashCollection) return;
  if (!canWriteCashCollection()) return;
  pendingCashWrites = loadPendingWrites();
  if (!pendingCashWrites.length) return;
  const toFlush = [...pendingCashWrites];
  try {
    await Promise.all(
      toFlush.map((p) => {
        const [col, id] = p.docPath.split("/");
        if (col === "cashCollectionSessions") return setDoc(cashCollectionSessionDoc(id), sanitize(p.data as any), { merge: true });
        return setDoc(cashCollectionRowDoc(id), sanitize(p.data as any), { merge: true });
      })
    );
    pendingCashWrites = [];
    savePendingWritesToStorage();
    console.debug("[janvi] flushPendingCashWrites: flushed pending writes", { count: toFlush.length });
  } catch (err) {
    console.error("[janvi] flushPendingCashWrites failed", err);
    scheduleFlushPendingWrites(5000);
  }
};


const deleteCashCollectionRows = (rowIds: string[]) => {
  if (rowIds.length === 0) return;
  const batch = writeBatch(db);
  rowIds.forEach((rowId) => batch.delete(cashCollectionRowDoc(rowId)));
  void batch.commit();
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
      attachCashCollectionListeners();
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
      // Attempt to flush any pending cash writes when cloud becomes ready
      try {
        flushPendingCashWrites();
      } catch {}
      useData.subscribe(queueCloudSave);
    })
    .catch(() => {
      cloudReady = true;
      useData.setState({ syncReady: true });
      try {
        flushPendingCashWrites();
      } catch {}
    });

  onSnapshot(appStateRef(), (snapshot) => {
    if (!snapshot.exists()) return;
    if (!cloudReady) return;
    const nextState = toPersistedDataState(snapshot.data() as Partial<PersistedDataState>);
    if (snapshot.metadata.hasPendingWrites) return;
    if (lastCloudData && samePersistedData(nextState, lastCloudData)) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    lastCloudData = nextState;
    if (samePersistedData(getPersistedDataSnapshot(useData.getState()), nextState)) return;
    applyingRemoteData = true;
    useData.setState(nextState);
    applyingRemoteData = false;
  }, (error) => {
    console.error("app state snapshot error", error);
  });

  attachCashCollectionListeners();
  // Retry pending writes when network returns
  try {
    window.addEventListener("online", () => void flushPendingCashWrites());
  } catch {}
};

