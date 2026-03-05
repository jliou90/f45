import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { AccountingControlCenterPage } from "./pages/AccountingControlCenterPage";
import { AccountingDetailPage } from "./pages/AccountingDetailPage";
import { AccountingEditPage } from "./pages/AccountingEditPage";
import { AccountingListPage } from "./pages/AccountingListPage";
import { AccountingNewPage } from "./pages/AccountingNewPage";
import { AccountingOpsInboxPage } from "./pages/AccountingOpsInboxPage";

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
        path="/dms/accounting/control-center"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingControlCenterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/accounting/inbox"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingOpsInboxPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/accounting/:recordId"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/accounting/:recordId/edit"
        element={
          <ProtectedRoute route="ACCOUNTING">
            <AccountingEditPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

