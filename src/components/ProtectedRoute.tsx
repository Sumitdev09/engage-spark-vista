import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = ({
  children,
  requireRole,
}: {
  children: JSX.Element;
  requireRole?: "hr" | "employee";
}) => {
  const { user, role, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-subtle">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole && role !== requireRole) {
    return <Navigate to={role === "hr" ? "/hr" : "/employee"} replace />;
  }
  return children;
};