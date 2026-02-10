import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";

export function useAuth() {
  const [, setLocation] = useLocation();

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/login", { email });
      return res.json() as Promise<User>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      if (data.role === "admin") {
        setLocation("/admin/users");
      } else {
        setLocation("/");
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      setLocation("/login");
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
    signIn: loginMutation.mutateAsync,
    signOut: logoutMutation.mutateAsync,
    isSigningIn: loginMutation.isPending,
    isSigningOut: logoutMutation.isPending,
    signInError: loginMutation.error,
  };
}
