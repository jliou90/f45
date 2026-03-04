import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { CommsPage } from "./pages/CommsPage";

export function CommsRoutes() {
  return (
    <>
      <Route
        path="/dms/comms"
        element={
          <ProtectedRoute route="COMMS">
            <CommsPage />
          </ProtectedRoute>
        }
      />
    </>
  );
}

