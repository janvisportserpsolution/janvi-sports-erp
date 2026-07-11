import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { initializeFirebaseBackend, useAuth, useData } from "./store";
import { canAccessRoute } from "./rbac";

const ROUTE_ORDER = [
  "/",
  "/inventory",
  "/billing",
  "/invoices",
  "/returns",
  "/customers",
  "/collections",
  "/reports",
  "/statements",
  "/settings",
];
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Billing from "./pages/Billing";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import Returns from "./pages/Returns";
import Customers from "./pages/Customers";
import CustomerView from "./pages/CustomerView";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Statements from "./pages/Statements";
import Collections from "./pages/Collections";
import CollectionView from "./pages/CollectionView";

function Protected({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const authReady = useAuth((s) => s.authReady);
  if (!authReady) return <div className="p-10 text-center text-slate-600">Connecting securely...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePermission({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const authReady = useAuth((s) => s.authReady);
  const location = useLocation();
  if (!authReady) return <div className="p-10 text-center text-slate-600">Connecting securely...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessRoute(user, location.pathname)) {
    const firstAllowed = ROUTE_ORDER.find((path) => canAccessRoute(user, path));
    return firstAllowed ? <Navigate to={firstAllowed} replace /> : <div className="p-10 text-center text-slate-700">You do not have access to any allowed section.</div>;
  }
  return <>{children}</>;
}

export default function App() {
  const seed = useData((s) => s.seed);
  const initialized = useData((s) => s.initialized);
  useEffect(() => {
    initializeFirebaseBackend();
  }, []);

  useEffect(() => {
    if (!initialized) seed();
  }, [initialized, seed]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <RequirePermission>
              <Layout />
            </RequirePermission>
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="billing" element={<Billing />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="returns" element={<Returns />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerView />} />
        <Route path="collections" element={<Collections />} />
        <Route path="collections/:id" element={<CollectionView />} />
        <Route path="reports" element={<Reports />} />
        <Route path="statements" element={<Statements />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
