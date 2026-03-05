import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { ActionCenterPage } from "./pages/ActionCenterPage";

export function ActionCenterRoutes() {
  return (
    <Route
      path="/dms/action-center"
      element={
        <ProtectedRoute route="DMS">
          <ActionCenterPage />
        </ProtectedRoute>
      }
    />
  );
}
