// Configuration constants for the TrailBase client application

export const TRAILBASE_URL = 'http://localhost:7000';

// Token refresh interval: 5 minutes (300000 ms)
// Auth tokens expire after 60 minutes, so refreshing every 5 minutes ensures
// we refresh well before expiration (12 refreshes per token lifetime)
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
