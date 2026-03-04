const base = (process.env.VITE_API_BASE_URL || "/api/v1").trim();

if (/localhost|127\.0\.0\.1/i.test(base)) {
  console.error("ERROR: VITE_API_BASE_URL cannot reference localhost in production builds.");
  console.error(`Received: ${base}`);
  process.exit(1);
}

if (!base.startsWith("/api/")) {
  console.warn(`WARN: VITE_API_BASE_URL is not relative to /api: ${base}`);
}
