import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecoveryPending: boolean;
}

const PASSWORD_RECOVERY_KEY = "nexa:password-recovery-pending";

function getStoredPasswordRecoveryPending(): boolean {
  return typeof window !== "undefined" && window.sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === "true";
}

export function isPasswordRecoveryPending(): boolean {
  return getStoredPasswordRecoveryPending();
}

export function setPasswordRecoveryPending(pending: boolean): void {
  if (typeof window === "undefined") return;
  if (pending) {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
  } else {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
  }
  state = { ...state, passwordRecoveryPending: pending };
  listeners.forEach((l) => l());
}

let state: AuthState = {
  session: null,
  user: null,
  loading: true,
  passwordRecoveryPending: false,
};
const listeners = new Set<() => void>();
let started = false;

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Single shared Supabase auth subscription — never duplicated per component. */
function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  void supabase.auth.getSession().then(({ data }) => {
    set({
      session: data.session ?? null,
      user: data.session?.user ?? null,
      loading: false,
      passwordRecoveryPending: getStoredPasswordRecoveryPending(),
    });
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      setPasswordRecoveryPending(true);
    }
    set({
      session: session ?? null,
      user: session?.user ?? null,
      loading: false,
      passwordRecoveryPending: getStoredPasswordRecoveryPending(),
    });
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState: AuthState = { session: null, user: null, loading: true, passwordRecoveryPending: false };

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}
