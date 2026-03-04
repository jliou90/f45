import { publishWindowSync } from "./window-sync";

export type Branding = {
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
};

export type ResolvedBranding = {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
};

const DEFAULT_BRANDING: ResolvedBranding = {
  brandName: "KUTM",
  primaryColor: "#0b5ed7",
  secondaryColor: "#213d57",
  logoUrl: null,
};

const brandingByTenant = new Map<string, ResolvedBranding>();

function sanitizeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgb\(/.test(trimmed) || /^hsl\(/.test(trimmed)) return trimmed;
  return fallback;
}

export function resolveBranding(input?: Branding | null): ResolvedBranding {
  return {
    brandName: input?.brandName?.trim() || DEFAULT_BRANDING.brandName,
    primaryColor: sanitizeColor(input?.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: sanitizeColor(input?.secondaryColor, DEFAULT_BRANDING.secondaryColor),
    logoUrl: input?.logoUrl?.trim() || null,
  };
}

export function mergeBranding(primary?: Branding | null, secondary?: Branding | null): ResolvedBranding {
  return resolveBranding({
    brandName: primary?.brandName ?? secondary?.brandName,
    primaryColor: primary?.primaryColor ?? secondary?.primaryColor,
    secondaryColor: primary?.secondaryColor ?? secondary?.secondaryColor,
    logoUrl: primary?.logoUrl ?? secondary?.logoUrl,
  });
}

export function applyBranding(branding: ResolvedBranding): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", branding.primaryColor);
  root.style.setProperty("--brand-secondary", branding.secondaryColor);
}

export function setTenantBranding(tenantId: string, metadata?: Branding | null, broadcast = true): ResolvedBranding {
  const resolved = resolveBranding(metadata);
  brandingByTenant.set(tenantId, resolved);
  applyBranding(resolved);
  if (broadcast) {
    publishWindowSync({
      type: "BRANDING_UPDATED",
      payload: { tenantId, branding: resolved },
    });
  }
  return resolved;
}

export function getTenantBranding(tenantId: string | null | undefined): ResolvedBranding {
  if (!tenantId) return DEFAULT_BRANDING;
  return brandingByTenant.get(tenantId) ?? DEFAULT_BRANDING;
}

export function getBrandingSnapshot(): Record<string, ResolvedBranding> {
  return Object.fromEntries(brandingByTenant.entries());
}

export function getDefaultBranding(): ResolvedBranding {
  return DEFAULT_BRANDING;
}
