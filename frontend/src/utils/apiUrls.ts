/**
 * Utility functions for API URL handling
 * 
 * These functions ensure that API URLs are properly resolved against the current origin
 * when using relative or empty URLs, which is crucial for reverse proxy setups in production.
 */

/**
 * Get an absolute API URL based on the environment variable or current origin
 * @returns The absolute API URL to use for requests
 */
export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // If empty string, use current origin
  if (baseUrl === '') {
    return window.location.origin;
  } 
  // If relative URL, prepend current origin
  else if (baseUrl.startsWith('/')) {
    return `${window.location.origin}${baseUrl}`;
  }
  // Otherwise use the provided URL (could be localhost in development)
  return baseUrl;
}

/**
 * Get a WebSocket URL derived from the API base URL
 * @returns A properly formatted WebSocket URL
 */
export function getWebSocketBaseUrl(): string {
  const baseUrl = getApiBaseUrl();
  const isSecure = window.location.protocol === 'https:';
  
  // Convert HTTP/HTTPS URL to WS/WSS URL
  return baseUrl
    .replace(/^http:\/\//, isSecure ? 'wss://' : 'ws://')
    .replace(/^https:\/\//, 'wss://')
    .replace(/\/$/, '');
}

/**
 * Log API URL configuration (useful for debugging)
 */
export function logApiConfig(): void {
  console.log('API Base URL:', getApiBaseUrl());
  console.log('WebSocket Base URL:', getWebSocketBaseUrl());
}