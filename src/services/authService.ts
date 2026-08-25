import { supabase } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";
import type { Session, User } from "@supabase/supabase-js";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly translationKey?: string,
  ) {
    super(message);
  }
}

function friendly(message: string): { message: string; translationKey?: string } {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return { message: "Wrong email or password." };
  if (m.includes("email not confirmed")) return { message: "Confirm your email first — check your inbox." };
  if (m.includes("already registered")) return { message: "That email already has an account. Sign in instead." };
  if (m.includes("password should be")) return { message: "Password must be at least 6 characters." };
  if (m.includes("rate limit") || m.includes("too many attempts")) {
    return {
      message: "Too many attempts in a short period. Please wait a few minutes and try again.",
      translationKey: "auth.error.rateLimit",
    };
  }
  return { message };
}

function authError(message: string): AuthError {
  const normalized = friendly(message);
  return new AuthError(normalized.message, normalized.translationKey);
}

export function authErrorMessage(
  error: unknown,
  t: (key: string) => string,
  fallback: string,
): string {
  if (error instanceof AuthError && error.translationKey) return t(error.translationKey);
  if (error instanceof Error) {
    const normalized = friendly(error.message);
    return normalized.translationKey ? t(normalized.translationKey) : error.message;
  }
  return fallback;
}

export async function signUp(email: string, password: string): Promise<{ session: Session | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/app` },
  });
  if (error) throw authError(error.message);
  return { session: data.session };
}

export async function signIn(email: string, password: string): Promise<{ session: Session | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authError(error.message);
  return { session: data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw authError(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  });
  if (error) throw authError(error.message);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw authError(error.message);
}

export async function updateDisplayName(fullName: string): Promise<User> {
  const { data, error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
  if (error) throw authError(error.message);
  return data.user;
}

export async function updateLanguagePreference(locale: Locale): Promise<User> {
  const { data, error } = await supabase.auth.updateUser({ data: { locale } });
  if (error) throw authError(error.message);
  return data.user;
}

/** Revalidated against the auth server — use for any trust decision. */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}
