import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

import { useEffect, useState } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated: convexIsAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  // Derive loading per render to handle transitions correctly
  const isLoading = isAuthLoading || user === undefined;
  const isAuthenticated = convexIsAuthenticated && user !== null;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}