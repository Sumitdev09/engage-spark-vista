import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import EmployeeDashboard from "./pages/EmployeeDashboard.tsx";
import HRDashboard from "./pages/hr/HRDashboard.tsx";
import HREmployees from "./pages/hr/HREmployees.tsx";
import HRFormBuilder from "./pages/hr/HRFormBuilder.tsx";
import { AuthProvider } from "./hooks/useAuth.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/employee"
              element={
                <ProtectedRoute requireRole="employee">
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr"
              element={
                <ProtectedRoute requireRole="hr">
                  <HRDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/employees"
              element={
                <ProtectedRoute requireRole="hr">
                  <HREmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/form-builder"
              element={
                <ProtectedRoute requireRole="hr">
                  <HRFormBuilder />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
