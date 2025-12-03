import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { Analytics } from "@/components/Analytics";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import BankDashboard from "./pages/BankDashboard";
import { SpecialistDashboard } from "./pages/SpecialistDashboard";
import { ChartBuilderPage } from "./pages/ChartBuilderPage";
import FarmerProfilePage from "./pages/FarmerProfilePage";
import NotFound from "./pages/NotFound";

// Optimized QueryClient configuration to prevent network spam
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global defaults to prevent excessive requests
      staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
      gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes (renamed from cacheTime in React Query v5)
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: true, // Refetch when component mounts
      retry: 1, // Only retry failed requests once
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1, // Only retry failed mutations once
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ImpersonationBanner />
          <Analytics />
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/banks" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminDashboard />} />
            <Route path="/admin/charts/new" element={<ChartBuilderPage />} />
            <Route path="/admin/charts/:id" element={<ChartBuilderPage />} />
            <Route path="/admin/debug" element={<AdminDashboard />} />
            <Route path="/bank" element={<BankDashboard />} />
            <Route path="/specialist" element={<Navigate to="/specialist/dashboard" replace />} />
            <Route path="/specialist/dashboard" element={<SpecialistDashboard />} />
            <Route path="/farmers/:farmerId" element={<FarmerProfilePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallPrompt />
          <OfflineIndicator />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
