import { useState, useEffect } from "react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader as SheetHead, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { LogOut, Menu, X, Users, Settings } from "lucide-react";
import { FarmersTable } from "@/components/FarmersTable";
import { FarmerListView } from "@/components/FarmerListView";
import { BankFilters } from "@/components/BankFilters";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/components/ui/use-toast";

interface Bank {
  id: string;
  name: string;
  logo_url: string;
}

const BankDashboard = () => {
  const { user, profile, signOut, loading } = useAuth();
  const userProfile = profile as UserProfile | null;
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [bank, setBank] = useState<Bank | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    fromDate: "",
    toDate: "",
    bankId: "", // Will be set when profile loads
  });

  // Check authentication and redirect if session expired
  useEffect(() => {
    if (!loading && !user) {
      console.log('🔒 User session expired or not authenticated, redirecting to login');
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please log in again to continue.",
        variant: "destructive"
      });
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Check user role and redirect if not bank viewer or specialist
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        console.log('🔒 Admin user redirecting to admin dashboard');
        navigate('/admin', { replace: true });
      } else if (profile.role === 'specialist') {
        console.log('🔒 Specialist user redirecting to specialist dashboard');
        navigate('/specialist', { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    const fetchBank = async () => {
      if (userProfile?.bank_id) {
        // Set the bank filter for bank users to only see their own farmers
        setFilters(prev => ({ ...prev, bankId: userProfile.bank_id }));
  
        const { data } = await supabase
          .from('banks')
          .select('*')
          .eq('id', userProfile.bank_id)
          .maybeSingle();
        
        if (data) {
          setBank(data);
        }
      }
    };

    fetchBank();
  }, [userProfile]);

  // Show loading while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-dark-bg transition-colors flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if user is not authenticated (will be redirected by useEffect)
  if (!user || !profile) {
    return null;
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
          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle variant="icon" size="sm" />
            <Button 
              variant="outline" 
              onClick={handleSignOut} 
              className="hidden md:flex
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

      <div className="relative z-10 container mx-auto px-4 py-6 pb-20 md:pb-6">
        <div className="space-y-6">
          <BankFilters 
            filters={{ search: filters.search, fromDate: filters.fromDate, toDate: filters.toDate }} 
            onFiltersChange={handleFiltersChange} 
          />
          <FarmerListView 
            filters={filters} 
            isAdmin={false}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation - Hidden on Desktop */}
      <div className="md:hidden">
        {/* Bottom Sheet Navigation */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent 
            side="bottom" 
            className="h-[50vh] rounded-t-3xl p-0 border-t-2 dark:border-dark-border"
          >
            <div className="flex flex-col h-full">
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b dark:border-dark-border">
                <h2 className="text-xl font-semibold text-heading-primary">Menu</h2>
                <p className="text-sm text-body-muted mt-1">{bank?.name || 'TelAgri'}</p>
              </div>

              {/* Menu Items */}
              <nav className="flex-1 overflow-y-auto px-4 py-6">
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      document.getElementById('filters')?.scrollIntoView({ behavior: 'smooth' });
                      setMobileNavOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 text-foreground dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border active:bg-gray-100 dark:active:bg-dark-border/80"
                  >
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-border">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Farmers</p>
                      <p className="text-xs text-body-muted mt-0.5">View farmer loans and data</p>
                    </div>
                  </button>
                </div>
              </nav>

              {/* Footer Actions */}
              <div className="px-4 py-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-border/30">
                <button
                  onClick={async () => {
                    setMobileNavOpen(false);
                    await handleSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl 
                           bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 
                           hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-card border-t dark:border-dark-border shadow-lg z-40">
          <div className="relative flex items-center justify-around h-16 px-4">
            {/* Farmers */}
            <button
              className="flex flex-col items-center justify-center w-20 text-emerald-600 dark:text-emerald-400"
            >
              <Users className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">Farmers</span>
            </button>

            {/* Central FAB - Placeholder for spacing */}
            <div className="w-16" />

            {/* Menu Button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center justify-center w-20 text-gray-600 dark:text-gray-400 transition-colors"
            >
              <Settings className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>

          {/* Central Floating Action Button */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-8">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-600 to-green-700 dark:from-emerald-500 dark:to-green-600 
                         text-white shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 
                         transition-all duration-200 flex items-center justify-center"
              aria-label="Open menu"
            >
              {mobileNavOpen ? (
                <X className="h-7 w-7" />
              ) : (
                <Menu className="h-7 w-7" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankDashboard;