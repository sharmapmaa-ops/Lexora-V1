import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/lib/authStore";

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) return <Navigate to="/login" replace />;
  if (adminOnly && user && user.role !== "admin" && user.role !== "developer") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
