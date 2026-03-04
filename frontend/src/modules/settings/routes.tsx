import { Navigate, Route } from "react-router-dom";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { SettingsLayout } from "./layout/SettingsLayout";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SessionsPage } from "./pages/SessionsPage";
import { ShortcutsPage } from "./pages/ShortcutsPage";
import { AccessPage } from "./pages/AccessPage";
import { WorkspacePage } from "./pages/WorkspacePage";

export function settingsRoutes() {
  return (
    <Route
      path="/settings"
      element={
        <ProtectedRoute requireTenant>
          <SettingsLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/settings/profile" replace />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="preferences" element={<PreferencesPage />} />
      <Route path="workspace" element={<WorkspacePage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="sessions" element={<SessionsPage />} />
      <Route path="shortcuts" element={<ShortcutsPage />} />
      <Route path="access" element={<AccessPage />} />
    </Route>
  );
}
