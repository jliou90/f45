import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/use-auth";
import { useFeatureFlags } from "../app/use-feature-flags";
import { useTenant } from "../app/use-tenant";
import { getTenantBranding } from "../lib/branding";
import { canAccess } from "../lib/rbac";
import { getFavorites, getRecentRoutes, toggleFavorite } from "../lib/prefs";
import { getLauncherTiles, getNavModel } from "../plugins/registry";
import { Button, Card, Input } from "../ui";

type TileProps = {
  appId: string;
  name: string;
  description: string;
  to: string;
  accessBadge?: string;
  favorite: boolean;
  onToggleFavorite: (appId: string) => void;
};

function LauncherTile({ appId, name, description, to, accessBadge, favorite, onToggleFavorite }: TileProps) {
  return (
    <article className="launcherTile">
      <div className="launcherTileHeader">
        <Link to={to} className="launcherTileTitle">
          {name}
        </Link>
        <Button
          type="button"
          className={favorite ? "starButton active" : "starButton"}
          aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
          onClick={() => onToggleFavorite(appId)}
        >
          {favorite ? "Unfav" : "Fav"}
        </Button>
      </div>
      <p className="muted">{description}</p>
      {accessBadge ? <span className="badge">{accessBadge}</span> : null}
    </article>
  );
}

export function LauncherPage() {
  const auth = useAuth();
  const tenant = useTenant();
  const featureFlags = useFeatureFlags();
  const navigate = useNavigate();
  const userKey = auth.user?.email;
  const [query, setQuery] = useState("");
  const [favorites, setFavoritesState] = useState<string[]>(() => getFavorites(userKey));
  const recentRoutes = getRecentRoutes(userKey);
  const branding = getTenantBranding(tenant.tenantId);

  const apps = useMemo(() => {
    const isDev = import.meta.env.DEV;
    const navByPath = new Map(
      getNavModel({ featureFlags: featureFlags.flags as Record<string, boolean | string | number>, isDev }).map((item) => [item.to, item]),
    );
    const allowed = getLauncherTiles({
      featureFlags: featureFlags.flags as Record<string, boolean | string | number>,
      isDev,
    })
      .filter((item) => (item.devOnly ? isDev : true))
      .filter((item) => {
        const nav = navByPath.get(item.to);
        if (!nav) return true;
        return canAccess(nav.routePolicy, tenant.currentRole, isDev);
      });

    const lower = query.trim().toLowerCase();
    if (!lower) return allowed;
    return allowed.filter((item) => {
      const haystack = `${item.name} ${item.description} ${item.keywords.join(" ")}`.toLowerCase();
      return haystack.includes(lower);
    });
  }, [query, tenant.currentRole, featureFlags.flags]);

  const favoriteApps = apps.filter((item) => favorites.includes(item.id));
  const allAppsById = new Map(apps.map((item) => [item.id, item]));

  const onToggleFavorite = (appId: string) => {
    const next = toggleFavorite(appId, userKey);
    setFavoritesState(next);
  };

  return (
    <div className="stack">
      <Card>
        <h1>{branding.brandName} Launcher</h1>
        <p className="muted">Search modules, jump into workflow, and keep high-use apps pinned.</p>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search apps, modules, and actions..."
          aria-label="Search apps"
        />
      </Card>

      <Card>
        <div className="sectionHeader">
          <h2>Favorites</h2>
        </div>
        {favoriteApps.length > 0 ? (
          <div className="launcherGrid">
            {favoriteApps.map((item) => (
              <LauncherTile
                key={item.id}
                appId={item.id}
                name={item.name}
                description={item.description}
                to={item.to}
                accessBadge={item.accessBadge}
                favorite
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <p className="muted">No favorites yet. Use the star on any app tile.</p>
        )}
      </Card>

      <Card>
        <h2>Recent</h2>
        {recentRoutes.length > 0 ? (
          <ul className="recentList">
            {recentRoutes.map((route) => {
              const app = apps.find((item) => item.to === route);
              return (
                <li key={route}>
                  <button type="button" className="linkButton" onClick={() => navigate(route)}>
                    {app?.name ?? route}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No recent routes yet.</p>
        )}
      </Card>

      <Card>
        <h2>All Apps</h2>
        <div className="launcherGrid">
          {apps.map((item) => (
            <LauncherTile
              key={item.id}
              appId={item.id}
              name={item.name}
              description={item.description}
              to={item.to}
              accessBadge={item.accessBadge}
              favorite={favorites.includes(item.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2>Developer shortcuts</h2>
        <div className="row">
          {import.meta.env.DEV && allAppsById.has("dev-contracts") ? <Link to="/dev/contracts">Open Dev Contracts</Link> : null}
          <Button type="button" onClick={() => navigate("/ops/outbox")}>Open Outbox</Button>
        </div>
      </Card>
    </div>
  );
}

