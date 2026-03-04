import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/use-auth";
import { useFeatureFlags } from "../app/use-feature-flags";
import { useTenant } from "../app/use-tenant";
import { useTelemetry } from "../app/use-telemetry";
import { canAccess } from "../lib/rbac";
import { type ThemeMode } from "../lib/prefs";
import { usePluginContext } from "../plugins/context";
import { getLauncherTiles, getNavModel, getPaletteCommands } from "../plugins/registry";
import type { Command } from "../plugins/types";

type CommandPaletteProps = {
  onToggleTheme: () => void;
  currentThemeMode: ThemeMode;
};

export function CommandPalette({ onToggleTheme, currentThemeMode }: CommandPaletteProps) {
  const navigate = useNavigate();
  const auth = useAuth();
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const telemetry = useTelemetry();
  const pluginContext = usePluginContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setOpen((value) => {
          const next = !value;
          if (next) {
            setQuery("");
            setSelectedIndex(0);
          }
          return next;
        });
      }
      if (!open) return;
      if (key === "escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const isDev = import.meta.env.DEV;
    const navByPath = new Map(
      getNavModel({ featureFlags: featureFlags.flags as Record<string, boolean | string | number>, isDev }).map((item) => [item.to, item]),
    );
    const routeCommands: Command[] = getLauncherTiles({
      featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
      isDev,
    })
      .filter((item) => (item.devOnly ? isDev : true))
      .filter((item) => {
        const nav = navByPath.get(item.to);
        if (!nav) return true;
        return canAccess(nav.routePolicy, tenant.currentRole, isDev);
      })
      .map((item) => ({
        id: `nav:${item.to}`,
        label: `Go to ${item.name}`,
        keywords: ["navigate", "open", ...item.keywords],
        run: () => {
          navigate(item.to);
          setOpen(false);
        },
      }));

    const actionCommands: Command[] = [
      {
        id: "action:logout",
        label: "Logout",
        keywords: ["sign out", "auth"],
        run: () => {
          auth.logout();
          tenant.clearTenant();
          navigate("/login");
          setOpen(false);
        },
      },
      {
        id: "action:switch-tenant",
        label: "Switch tenant",
        keywords: ["tenant", "organization"],
        run: () => {
          navigate("/tenant-picker");
          setOpen(false);
        },
      },
      {
        id: "action:copy-debug",
        label: "Copy debug bundle",
        keywords: ["logs", "telemetry", "debug"],
        run: async () => {
          await telemetry.copyDebugBundle();
          setOpen(false);
        },
      },
      {
        id: "action:open-ops",
        label: "Open ops",
        keywords: ["health", "status"],
        run: () => {
          navigate("/admin/ops");
          setOpen(false);
        },
      },
      {
        id: "action:download-support-bundle",
        label: "Download support bundle",
        keywords: ["support", "bundle", "export", "ops"],
        run: async () => {
          await telemetry.downloadSupportBundle();
          setOpen(false);
        },
      },
      {
        id: "action:toggle-theme",
        label: `Toggle theme (current: ${currentThemeMode})`,
        keywords: ["theme", "dark", "light"],
        run: () => {
          onToggleTheme();
          setOpen(false);
        },
      },
    ];

    const pluginCommands = getPaletteCommands(pluginContext, {
      featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
      isDev,
    });

    return [...routeCommands, ...actionCommands, ...pluginCommands];
  }, [auth, tenant, telemetry, navigate, currentThemeMode, onToggleTheme, featureFlags.flags, pluginContext]);

  const filteredCommands = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return commands;
    return commands.filter((command) => {
      const haystack = `${command.label} ${command.keywords.join(" ")}`.toLowerCase();
      return haystack.includes(lower);
    });
  }, [query, commands]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((value) => (filteredCommands.length === 0 ? 0 : (value + 1) % filteredCommands.length));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((value) =>
          filteredCommands.length === 0 ? 0 : (value - 1 + filteredCommands.length) % filteredCommands.length,
        );
      }
      if (event.key === "Enter") {
        const command = filteredCommands[selectedIndex];
        if (command) {
          event.preventDefault();
          void command.run();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, filteredCommands, selectedIndex]);

  if (!open) return null;

  return (
    <div className="paletteOverlay" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <label className="paletteInputWrap">
          <span className="muted">Command</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or route..."
            aria-label="Command palette input"
          />
        </label>
        <ul className="paletteList" role="listbox" aria-label="Commands">
          {filteredCommands.length === 0 ? <li className="muted">No matching commands.</li> : null}
          {filteredCommands.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                className={index === selectedIndex ? "paletteItem selected" : "paletteItem"}
                aria-selected={index === selectedIndex}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => void command.run()}
              >
                {command.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

