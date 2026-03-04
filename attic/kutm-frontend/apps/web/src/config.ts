const DEFAULT_API_BASE_URL = "http://127.0.0.1:8010";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const MSW_ENABLED = import.meta.env.VITE_USE_MSW === "true";
