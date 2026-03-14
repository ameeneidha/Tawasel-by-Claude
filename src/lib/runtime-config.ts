const trimTrailingSlash = (value?: string) => (value || '').trim().replace(/\/$/, '');

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
export const SOCKET_URL = trimTrailingSlash(import.meta.env.VITE_SOCKET_URL) || API_BASE_URL;
export const PUBLIC_APP_URL = trimTrailingSlash(import.meta.env.VITE_PUBLIC_APP_URL);

export const getAllowedMessageOrigins = () => {
  const origins = new Set<string>([window.location.origin]);
  if (API_BASE_URL) {
    origins.add(API_BASE_URL);
  }
  if (PUBLIC_APP_URL) {
    origins.add(PUBLIC_APP_URL);
  }
  return origins;
};
