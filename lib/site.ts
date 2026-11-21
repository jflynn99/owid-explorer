// The site's name and address, in one place.

export const SITE_NAME = "OWID Explorer";

// Absolute URLs (share images, canonical links) need a base. Vercel sets
// VERCEL_PROJECT_PRODUCTION_URL; local dev falls back to localhost.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : `http://localhost:${process.env.PORT ?? 3000}`;
