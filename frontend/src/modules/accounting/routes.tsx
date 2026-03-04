import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AccountingDetailPage } from "./pages/AccountingDetailPage";
import { AccountingEditPage } from "./pages/AccountingEditPage";
import { AccountingListPage } from "./pages/AccountingListPage";
import { AccountingNewPage } from "./pages/AccountingNewPage";

export function AccountingRoutes() {
  return (
    <>
      <Route
        path="/dms/accounting"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/accounting/new"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingNewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/accounting/:periodId"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/accounting/:periodId/edit"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingEditPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

