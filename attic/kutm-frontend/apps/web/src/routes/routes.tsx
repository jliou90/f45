import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../app/AppShell";
import { LoginPage } from "../features/auth/LoginPage";
import { LauncherPage } from "../features/launcher/LauncherPage";
import { CustomerPage } from "../features/customer/CustomerPage";
import { useAuth } from "../features/auth/authStore";

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/launcher" element={<LauncherPage />} />
        <Route path="/customers/:customerId" element={<CustomerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/launcher" replace />} />
    </Routes>
  );
}
