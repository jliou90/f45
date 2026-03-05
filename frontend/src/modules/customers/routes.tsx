import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { Customer360Page } from "./pages/Customer360Page";
import { CustomerEditPage } from "./pages/CustomerEditPage";
import { CustomerListPage } from "./pages/CustomerListPage";
import { CustomerNewPage } from "./pages/CustomerNewPage";

export function CustomerRoutes() {
  return (
    <>
      <Route
        path="/dms/customers"
        element={
          <ProtectedRoute route="CUSTOMERS">
            <CustomerListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/customers/new"
        element={
          <ProtectedRoute route="CUSTOMERS">
            <CustomerNewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/customers/:itemId"
        element={
          <ProtectedRoute route="CUSTOMERS">
            <CustomerDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/customers/:itemId/overview"
        element={
          <ProtectedRoute route="CUSTOMERS">
            <Customer360Page />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/customers/:itemId/edit"
        element={
          <ProtectedRoute route="CUSTOMERS">
            <CustomerEditPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}
