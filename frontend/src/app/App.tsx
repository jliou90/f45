import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BOOTSTRAP_RETRY_DELAY_MS, runBootstrapFlow, type BootstrapSnapshot } from "./bootstrap";
import { markOpsMilestone } from "../core/ops";
import { AppLayout } from "./layout";
import { AppProviders } from "./providers";
import { useAuth } from "./use-auth";
import { useFeatureFlags } from "./use-feature-flags";
import { useTenant } from "./use-tenant";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PrintPreviewPage } from "../pages/PrintPreviewPage";
import { SystemPage } from "../pages/SystemPage";
import { TenantPickerPage } from "../pages/TenantPickerPage";
import { getStoredAccessToken, getStoredRefreshToken } from "../lib/storage";
import { getLastRoute } from "../lib/prefs";
import { usePluginContext } from "../plugins/context";
import { getRoutes, initPluginRegistry } from "../plugins/registry";
import { resolveDefaultLandingRoute } from "../modules/settings/data/settings.storage";

function BootingScreen({ snapshot }: { snapshot: BootstrapSnapshot }) {
  return (
    <div className="pageCentered">
      <div className="panel loginPanel">
        <h1>Booting session...</h1>
        <p className="muted">State: {snapshot.state}</p>
        <p>{snapshot.detail}</p>
        <p className="muted">Attempt: {snapshot.attempt}</p>
        <p>
          If writes were queued while offline, open <a href="/ops/outbox">Outbox</a> when available.
        </p>
      </div>
    </div>
  );
}

function AppRouter() {
  const auth = useAuth();
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const pluginContext = usePluginContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<BootstrapSnapshot>({
    state: "INIT",
    detail: "Preparing startup",
    attempt: 1,
  });
  const [ready, setReady] = useState(false);
  const retryTimeoutRef = useRef<number | null>(null);
  const { isAuthenticated, loadMe, refresh, logout } = auth;
  const { loadTenants, refreshCurrentTenant, clearTenant, tenantId } = tenant;

  useEffect(() => {
    void initPluginRegistry(pluginContext);
  }, [pluginContext]);

  const pluginRoutes = useMemo(
    () =>
      getRoutes({
        featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
        isDev: import.meta.env.DEV,
      }),
    [featureFlags.flags],
  );

  const isLoginPath = location.pathname === "/login";
  const shouldBootstrap = useMemo(() => {
    if (!isAuthenticated && isLoginPath) {
      return false;
    }
    return true;
  }, [isAuthenticated, isLoginPath]);

  useEffect(() => {
    if (isAuthenticated) {
      markOpsMilestone("auth_ready");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (tenantId) {
      markOpsMilestone("tenant_ready");
    }
  }, [tenantId]);

  useEffect(() => {
    if (!shouldBootstrap) {
      return;
    }

    let cancelled = false;

    const execute = async (attempt: number) => {
      const result = await runBootstrapFlow(
        {
          hasTokens: () => Boolean(getStoredAccessToken() && getStoredRefreshToken()),
          loadMe,
          refresh,
          loadTenants,
          hasSelectedTenant: () => Boolean(tenantId),
          verifySelectedTenant: refreshCurrentTenant,
        },
        (next) => {
          if (!cancelled) {
            setSnapshot(next);
          }
        },
        attempt,
      );

      if (cancelled) {
        return;
      }

      if (result === "READY") {
        setReady(true);
        if (location.pathname === "/login") {
          navigate(resolveDefaultLandingRoute(auth.user?.email, getLastRoute(auth.user?.email)), { replace: true });
        }
        return;
      }

      if (result === "NO_TOKENS") {
        setReady(true);
        if (!isLoginPath) {
          navigate("/login", { replace: true, state: { from: location.pathname } });
        }
        return;
      }

      if (result === "NO_TENANT_SELECTED") {
        setReady(true);
        if (location.pathname !== "/tenant-picker") {
          navigate("/tenant-picker", { replace: true, state: { from: location.pathname } });
        }
        return;
      }

      if (result === "TOKEN_EXPIRED") {
        logout();
        clearTenant();
        setReady(true);
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }

      setReady(false);
      if (result === "BACKEND_DOWN") {
        setReady(true);
        if (location.pathname !== "/system") {
          navigate("/system", { replace: true, state: { from: location.pathname } });
        }
        return;
      }

      retryTimeoutRef.current = window.setTimeout(() => {
        void execute(attempt + 1);
      }, BOOTSTRAP_RETRY_DELAY_MS);
    };

    void execute(1);

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [
    loadMe,
    refresh,
    logout,
    loadTenants,
    refreshCurrentTenant,
    clearTenant,
    tenantId,
    navigate,
    shouldBootstrap,
    location.pathname,
    isLoginPath,
    auth.user?.email,
  ]);

  const isReady = !shouldBootstrap || ready;

  useEffect(() => {
    if (isReady) {
      markOpsMilestone("first_route_render");
    }
  }, [isReady]);

  if (!isReady && !isLoginPath) {
    return <BootingScreen snapshot={snapshot} />;
  }

  return (
    <Routes>
      <Route path="/system" element={<SystemPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/tenant-picker"
        element={
          <ProtectedRoute>
            <TenantPickerPage />
          </ProtectedRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/print/:templateId" element={<PrintPreviewPage />} />
          <Route path="/print/repair-order/:id" element={<PrintPreviewPage templateIdOverride="repair-order" />} />
          <Route path="/print/quote/:id" element={<PrintPreviewPage templateIdOverride="quote" />} />
          {pluginRoutes}
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

