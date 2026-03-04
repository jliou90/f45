import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { SalesDetailPage } from "./pages/SalesDetailPage";
import { SalesEditPage } from "./pages/SalesEditPage";
import { SalesListPage } from "./pages/SalesListPage";
import { SalesNewPage } from "./pages/SalesNewPage";

export function SalesRoutes() {
  return (
    <>
      <Route
        path="/dms/sales"
        element={
          <ProtectedRoute route="SALES">
            <SalesListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/sales/new"
        element={
          <ProtectedRoute route="SALES">
            <SalesNewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/sales/:itemId"
        element={
          <ProtectedRoute route="SALES">
            <SalesDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/sales/:itemId/edit"
        element={
          <ProtectedRoute route="SALES">
            <SalesEditPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

