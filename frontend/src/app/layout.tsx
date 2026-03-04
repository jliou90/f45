import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "./use-auth";
import { useFeatureFlags } from "./use-feature-flags";
import { useConnectivity } from "./use-connectivity";
import { useTenant } from "./use-tenant";
import { useToast } from "./use-toast";
import { Banner } from "../components/Banner";
import { CommandPalette } from "../components/CommandPalette";
import { RequestLogDrawer } from "../components/RequestLogDrawer";
import { Sidebar } from "../components/Sidebar";
import { ShellErrorBoundary } from "../components/ShellErrorBoundary";
import { ToastViewport } from "../components/ToastViewport";
import { Topbar } from "../components/Topbar";
import { checkRequiredRoutes } from "../lib/contracts";
import { API_BASE_ORIGIN } from "../lib/kutm";
import { getAllPluginRouteRequirements } from "../plugins/registry";
import { addRecentRoute, applyTheme, getThemeMode, setLastRoute, setThemeMode, type ThemeMode } from "../lib/prefs";
import { getRealtimeStatus, startRealtime, subscribeRealtimeStatus, type RealtimeStatus } from "../lib/realtime";
import { APP_VERSION } from "../lib/version";
import { opsVersion } from "../lib/auth";
import { publishWindowSync, subscribeWindowSync } from "../lib/window-sync";
import { usePluginContext } from "../plugins/context";
import { getPlugins } from "../plugins/registry";
import { ImpersonationBanner } from "../modules/admin/components/ImpersonationBanner";
import { applyUserAppearance, getUserSettings } from "../modules/settings/data/settings.storage";

export function AppLayout() {
  const connectivity = useConnectivity();
  const auth = useAuth();
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const toast = useToast();
  const pluginContext = usePluginContext();
  const location = useLocation();
  const userKey = auth.user?.email;
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode(userKey));
  const [contractsMissing, setContractsMissing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(() => getRealtimeStatus());
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  useEffect(() => {
    setThemeModeState(getThemeMode(userKey));
  }, [userKey]);

  useEffect(() => {
    applyUserAppearance(getUserSettings(userKey), userKey);
  }, [userKey]);

  useEffect(() => {
    const mode = themeMode;
    applyTheme(mode);
    if (mode !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [themeMode]);

  useEffect(() => {
    addRecentRoute(location.pathname, userKey);
    setLastRoute(location.pathname, userKey);
  }, [location.pathname, userKey]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch(`${API_BASE_ORIGIN}/openapi.json`);
        if (!response.ok) return;
        const openApi = await response.json();
        if (cancelled) return;
        const pluginRequirements = getAllPluginRouteRequirements({
          featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
          isDev: import.meta.env.DEV,
        });
        setContractsMissing(!checkRequiredRoutes(openApi, pluginRequirements).ok);
      } catch {
        if (!cancelled) {
          setContractsMissing(true);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [featureFlags.flags]);

  useEffect(() => {
    return subscribeWindowSync((event) => {
      if (event.type !== "THEME_CHANGED") return;
      const mode = event.payload?.mode;
      if (mode === "light" || mode === "dark" || mode === "system") {
        applyTheme(mode);
        setThemeModeState(mode);
      }
    });
  }, []);

  useEffect(() => {
    return subscribeRealtimeStatus(setRealtimeStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const version = await opsVersion();
        if (!cancelled && typeof version.version === "string") {
          setBackendVersion(version.version);
        }
      } catch {
        if (!cancelled) {
          setBackendVersion(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!featureFlags.flags.realtimeEnabled) return;
    const plugins = getPlugins({
      featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
      isDev: import.meta.env.DEV,
    });
    const connection = startRealtime({
      enabled: Boolean(featureFlags.flags.realtimeEnabled),
      plugins,
      ctx: pluginContext,
      onUnauthorized: () => {
        toast.pushToast("error", "Realtime disconnected: unauthorized.");
      },
    });
    return () => {
      connection.stop();
    };
  }, [featureFlags.flags, toast, tenant.tenantId, pluginContext]);

  const toggleTheme = useMemo(() => {
    return () => {
      const next: ThemeMode = themeMode === "light" ? "dark" : "light";
      setThemeMode(next, userKey);
      setThemeModeState(next);
      applyTheme(next);
      publishWindowSync({ type: "THEME_CHANGED", payload: { mode: next } });
    };
  }, [themeMode, userKey]);

  return (
    <div className="shell">
      <Sidebar />
      <div className="shellBody">
        {connectivity.snapshot.status === "offline" ? <Banner message="Offline detected. Retrying health checks..." /> : null}
        {connectivity.snapshot.status === "degraded" ? <Banner message="Connectivity degraded. Some modules may respond slowly." /> : null}
        {import.meta.env.DEV && contractsMissing ? <Banner message="DEV: OpenAPI required endpoints missing." /> : null}
        <ImpersonationBanner />
        <Topbar themeMode={themeMode} onToggleTheme={toggleTheme} realtimeStatus={realtimeStatus} />
        <main className="content">
          <ShellErrorBoundary>
            <Outlet />
          </ShellErrorBoundary>
        </main>
        <footer className="footer muted">KUTM v{backendVersion ?? APP_VERSION}</footer>
      </div>
      <ToastViewport />
      <RequestLogDrawer />
      <CommandPalette onToggleTheme={toggleTheme} currentThemeMode={themeMode} />
    </div>
  );
}

