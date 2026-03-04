import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { WorkbenchDetailPage } from "./pages/WorkbenchDetailPage";
import { WorkbenchEditPage } from "./pages/WorkbenchEditPage";
import { WorkbenchListPage } from "./pages/WorkbenchListPage";

export function WorkbenchRoutes() {
  return (
    <>
      <Route
        path="/dms/workbench"
        element={
          <ProtectedRoute route="DMS">
            <WorkbenchListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/workbench/:itemId"
        element={
          <ProtectedRoute route="DMS">
            <WorkbenchDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dms/workbench/:itemId/edit"
        element={
          <ProtectedRoute route="DMS">
            <WorkbenchEditPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

