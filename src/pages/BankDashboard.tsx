import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { FarmersTable } from "@/components/FarmersTable";
import { BankFilters } from "@/components/BankFilters";
import { supabase } from "@/integrations/supabase/client";

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
  });



  useEffect(() => {
    const fetchBank = async () => {
      if (profile?.bank_id) {
  
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

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Futuristic Agri-Finance Background - Same as Login */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-green-50"></div>
      {/* Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(5, 150, 105, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(16, 185, 129, 0.3) 0%, transparent 50%),
          linear-gradient(90deg, rgba(5, 150, 105, 0.1) 1px, transparent 1px),
          linear-gradient(rgba(5, 150, 105, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 100% 100%, 50px 50px, 50px 50px'
      }}></div>
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400/30 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/3 w-3 h-3 bg-blue-400/20 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-teal-500/40 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <header className="relative z-10 border-b bg-white/60 backdrop-blur-md border-white/30 shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {bank?.logo_url && (
              <img 
                src={bank.logo_url} 
                alt={`${bank.name} logo`}
                className="h-10 w-auto"
              />
            )}
            <h1 className="text-2xl font-bold text-slate-700">
              {bank?.name || 'TelAgri'}
            </h1>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg active:scale-95 transform transition-all duration-300 hover:scale-105 shadow-md">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-6">
        <div className="bg-white/60 backdrop-blur-md border border-white/30 rounded-lg shadow-xl p-6 space-y-6">
          <BankFilters filters={filters} onFiltersChange={setFilters} />
          <FarmersTable filters={filters} isAdmin={false} />
        </div>
      </div>
    </div>
  );
};

export default BankDashboard;