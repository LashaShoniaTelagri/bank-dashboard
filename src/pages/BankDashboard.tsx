import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { FarmersTable } from "@/components/FarmersTable";
import { BankFilters } from "@/components/BankFilters";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Bank {
  id: string;
  name: string;
  logo_url: string;
}

const BankDashboard = () => {
  const { user, profile, signOut, loading } = useAuth();
  const [bank, setBank] = useState<Bank | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    fromDate: "",
    toDate: "",
    bankId: "", // Will be set when profile loads
  });



  useEffect(() => {
    const fetchBank = async () => {
      if (profile?.bank_id) {
        // Set the bank filter for bank users to only see their own farmers
        setFilters(prev => ({ ...prev, bankId: profile.bank_id }));
  
        const { data } = await supabase
          .from('banks')
          .select('*')
          .eq('id', profile.bank_id)
          .maybeSingle();
        
        if (data) {
          setBank(data);
        }
      }
    };

    fetchBank();
  }, [profile]);

  // Show loading while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {

    return <Navigate to="/auth" replace />;
  }

  // Redirect if admin (should go to admin dashboard)
  if (profile && profile.role === 'admin') {

    return <Navigate to="/admin" replace />;
  }

  // If user exists but no profile, show loading
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  // Wrapper function to handle filter updates while preserving bankId
  const handleFiltersChange = (newFilters: { search: string; fromDate: string; toDate: string }) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background transition-colors">
      {/* Futuristic Agri-Finance Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-primary/10 dark:via-accent/10 dark:to-primary/20"></div>
      
      {/* Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-20 dark:opacity-20">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, hsl(var(--accent) / 0.3) 0%, transparent 50%),
              radial-gradient(circle at 40% 80%, hsl(var(--primary) / 0.3) 0%, transparent 50%),
              linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px),
              linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 100% 100%, 100% 100%, 50px 50px, 50px 50px'
          }}
        />
      </div>
      
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400/30 dark:bg-primary/30 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/3 w-3 h-3 bg-green-400/30 dark:bg-accent/30 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-emerald-500/40 dark:bg-primary/40 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <header className="relative z-10 border-b bg-card/60 dark:bg-card/40 backdrop-blur-md border-border/30 shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {bank?.logo_url && (
              <img 
                src={bank.logo_url} 
                alt={`${bank.name} logo`}
                className="h-10 w-auto"
              />
            )}
            <h1 className="text-2xl font-bold text-heading-primary">
              {bank?.name || 'TelAgri'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle variant="icon" size="sm" />
            <Button 
              variant="outline" 
              onClick={handleSignOut} 
              className="
                bg-gradient-to-r from-emerald-600 to-green-600 
                hover:from-emerald-500 hover:to-green-500
                text-white font-medium border-emerald-400/30
                shadow-lg shadow-emerald-500/25 
                hover:shadow-xl hover:shadow-emerald-400/40
                transform transition-all duration-200 hover:scale-105
              "
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-6">
        <div className="bg-card/60 dark:bg-card/40 backdrop-blur-md border border-border/30 rounded-lg shadow-xl p-6 space-y-6">
          <BankFilters 
            filters={{ search: filters.search, fromDate: filters.fromDate, toDate: filters.toDate }} 
            onFiltersChange={handleFiltersChange} 
          />
          <FarmersTable filters={filters} isAdmin={false} />
        </div>
      </div>
    </div>
  );
};

export default BankDashboard;