import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "../routes/routes";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
