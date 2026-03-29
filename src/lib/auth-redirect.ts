import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";

/**
 * Paths used in `Linking.createURL` for Supabase email redirects.
 * Add the exact URLs printed by `getEmailConfirmationRedirectUrl()` /
 * `getPasswordResetRedirectUrl()` (and `sanctuary://**` if desired) under
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
 */
export const AUTH_EMAIL_CALLBACK_PATH = "auth/callback";
export const AUTH_PASSWORD_RESET_PATH = "auth/reset-password";

export function getEmailConfirmationRedirectUrl(): string {
  return Linking.createURL(AUTH_EMAIL_CALLBACK_PATH);
}

export function getPasswordResetRedirectUrl(): string {
  return Linking.createURL(AUTH_PASSWORD_RESET_PATH);
}

function parseQueryString(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!input) return result;
  for (const pair of input.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      result[decodeURIComponent(pair)] = "";
    } else {
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      result[key] = value;
    }
  }
  return result;
}

/** Parses query string and hash fragment; fragment keys override query (Supabase implicit flow). */
export function parseSupabaseAuthParams(url: string): Record<string, string> {
  const hashIdx = url.indexOf("#");
  const beforeHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const fragment = hashIdx >= 0 ? url.slice(hashIdx + 1) : "";

  const queryStart = beforeHash.indexOf("?");
  const queryString = queryStart >= 0 ? beforeHash.slice(queryStart + 1) : "";

  const fromQuery = parseQueryString(queryString);
  const fromHash = parseQueryString(fragment);
  return { ...fromQuery, ...fromHash };
}

/**
 * If the URL carries Supabase auth tokens, PKCE code, or an auth error, handle it and return true.
 * Otherwise return false (not an auth callback).
 */
export async function completeSessionFromAuthRedirectUrl(
  client: SupabaseClient,
  url: string,
): Promise<boolean> {
  const params = parseSupabaseAuthParams(url);

  const hasTokens = Boolean(params.access_token && params.refresh_token);
  const hasCode = Boolean(params.code);
  const hasAuthError = Boolean(params.error);

  if (!hasTokens && !hasCode && !hasAuthError) {
    return false;
  }

  if (params.error) {
    logger.warn(
      "Auth redirect error",
      params.error_description ?? params.error,
    );
    return true;
  }

  if (hasCode) {
    const { error } = await client.auth.exchangeCodeForSession(params.code);
    if (error) {
      logger.warn("exchangeCodeForSession failed", error);
    }
    return true;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await client.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) {
      logger.warn("setSession from deep link failed", error);
    }
    return true;
  }

  return false;
}
