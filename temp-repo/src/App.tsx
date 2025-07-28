import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import UnifiedDashboard from "./pages/UnifiedDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { DeviceDetail } from "./pages/DeviceDetail";
import { MotorDeviceDetail } from "./pages/MotorDeviceDetail";
import { Reports } from "./pages/Reports";
import { Admin } from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Dashboard Layout Component
const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader user={user!} />
          <main className="flex-1 bg-gradient-to-br from-background to-muted/20">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

// App Routes Component
const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth routes - accessible to everyone */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected dashboard routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout>
            <UnifiedDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/device/:deviceId" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DeviceDetail />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/motor-device/:deviceId" element={
        <ProtectedRoute>
          <DashboardLayout>
            <MotorDeviceDetail />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/reports" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Reports />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <DashboardLayout>
            <Admin />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
