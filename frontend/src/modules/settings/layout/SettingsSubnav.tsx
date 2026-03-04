import { NavLink } from "react-router-dom";

const links = [
  { to: "/settings/profile", label: "Profile" },
  { to: "/settings/preferences", label: "Preferences" },
  { to: "/settings/workspace", label: "Workspace" },
  { to: "/settings/notifications", label: "Notifications" },
  { to: "/settings/sessions", label: "Sessions" },
  { to: "/settings/shortcuts", label: "Shortcuts" },
  { to: "/settings/access", label: "Access & Permissions" },
];

export function SettingsSubnav() {
  return (
    <nav className="stack">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
