import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { ServiceEditPage } from "./pages/ServiceEditPage";
import { ServiceListPage } from "./pages/ServiceListPage";
import { ServiceNewPage } from "./pages/ServiceNewPage";

export function ServiceRoutes() {
  return (
    <>
      <Route
        path="/dms/service"
        element={
          <ProtectedRoute route="SERVICE">
            <ServiceListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/service/new"
        element={
          <ProtectedRoute route="SERVICE">
            <ServiceNewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/service/:itemId"
        element={
          <ProtectedRoute route="SERVICE">
            <ServiceDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/service/:itemId/edit"
        element={
          <ProtectedRoute route="SERVICE">
            <ServiceEditPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

