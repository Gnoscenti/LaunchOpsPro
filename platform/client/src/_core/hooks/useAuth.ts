import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

// ─── Self-Hosted Auth Bypass ─────────────────────────────────────────────────
// When VITE_AUTH_DISABLED is set to "true" at build time, all auth checks are
// bypassed and a mock admin user is returned. This allows the platform to run
// without the Manus OAuth portal on self-hosted deployments.
const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === "true";

const MOCK_USER = {
  id: 1,
  openId: "self-hosted-admin",
  name: "Admin",
  email: "admin@launchops.local",
  role: "admin" as const,
  subscriptionTier: "enterprise" as const,
  reportCount: 0,
  billingPeriodStart: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  loginMethod: "self-hosted",
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};
export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  // If auth is disabled, skip the tRPC query entirely
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !AUTH_DISABLED,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });
  const logout = useCallback(async () => {
    if (AUTH_DISABLED) return;
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    if (AUTH_DISABLED) {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(MOCK_USER)
      );
      return {
        user: MOCK_USER,
        loading: false,
        error: null,
        isAuthenticated: true,
      };
    }
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);
  useEffect(() => {
    if (AUTH_DISABLED) return;
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);
  return {
    ...state,
    refresh: () => AUTH_DISABLED ? Promise.resolve() : meQuery.refetch(),
    logout,
  };
}
