import { useState, useEffect, useRef } from "react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader as SheetHead, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { LogOut, Menu, X, LayoutDashboard, Building2, Users as UsersIcon, Bug, Settings } from "lucide-react";
import { FarmersTable } from "@/components/FarmersTable";
import { BanksManagement } from "@/components/BanksManagement";
import { UsersManagement } from "@/components/UsersManagement";
import { AdminFilters } from "@/components/AdminFilters";
import { InvitationDebugger } from "@/components/InvitationDebugger";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuditLogTable } from "@/components/AuditLogTable";
import { useIsMobile } from "@/hooks/use-mobile";

const AdminDashboard = () => {
  const { user, profile, signOut, loading } = useAuth();
  const userProfile = profile as UserProfile | null;
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const previousSection = useRef<string>('');
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState({
    search: "",
    bankId: "",
    fromDate: "",
    toDate: "",
  });

  // Determine active section from URL path
  const getActiveSection = () => {
    const path = location.pathname;
    if (path === '/admin/banks') return 'banks';
    if (path === '/admin/users') return 'users';
    if (path === '/admin/debug') return 'debug';
    return 'dashboard'; // default for /admin and /admin/dashboard
  };

  const activeSection = getActiveSection();

  // Show loading indicator when navigating between sections
  useEffect(() => {
    const currentSection = activeSection;
    
    if (previousSection.current && previousSection.current !== currentSection) {
      setIsPageTransitioning(true);
      
      // Scroll to top
      setTimeout(() => {
        if (contentAreaRef.current) {
          contentAreaRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
        
        // Hide loading after a brief moment
        setTimeout(() => {
          setIsPageTransitioning(false);
        }, 200);
      }, 0);
    }
    
    previousSection.current = currentSection;
  }, [activeSection]);



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

  // Redirect if not admin
  if (userProfile && userProfile.role !== 'admin') {

    return <Navigate to="/bank" replace />;
  }

  // If user exists but no profile, show loading or error
  if (user && !userProfile) {
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
        <div className="container-fluid mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer rounded-lg p-2 -m-2 transition-all duration-200 hover:bg-muted/60 dark:hover:bg-dark-border"
            onClick={() => { window.location.href = '/admin/dashboard'; }}
            title="Return to start page"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { (window.location.href = '/admin/dashboard'); } }}
          >
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading-primary">TelAgri</h1>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">System Administrator</p>
            </div>
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

      <div className="relative z-10 container-fluid mx-auto px-6 py-6 pb-20 md:pb-6">
          <div className="space-y-6">
          {/* Navigation */}
          <div className="border-b border-border/30 bg-card/40 dark:bg-card/30 backdrop-blur-sm rounded-t-lg shadow-lg">
            <nav className="-mb-px flex overflow-x-auto no-scrollbar space-x-2 md:space-x-8 p-2 md:p-4">
              <Link
                to="/admin/dashboard"
                className={`whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
                  activeSection === 'dashboard'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-transparent text-body-secondary hover:text-emerald-400'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/admin/banks"
                className={`whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
                  activeSection === 'banks'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-transparent text-body-secondary hover:text-emerald-400'
                }`}
              >
                Banks
              </Link>
              <Link
                to="/admin/users"
                className={`whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
                  activeSection === 'users'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-transparent text-body-secondary hover:text-emerald-400'
                }`}
              >
                Users
              </Link>
              <Link
                to="/admin/debug"
                className={`whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition-colors duration-200 rounded-t-lg ${
                  activeSection === 'debug'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-transparent text-body-secondary hover:text-emerald-400'
                }`}
              >
                Debug
              </Link>
            </nav>
          </div>

          {/* Content */}
          <div className="bg-card/60 dark:bg-card/40 backdrop-blur-md border border-border/30 rounded-b-lg shadow-xl p-6">
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                <AdminFilters filters={filters} onFiltersChange={setFilters} />
                <FarmersTable filters={filters} isAdmin={true} />
              </div>
            )}

            {activeSection === 'banks' && <BanksManagement />}

            {activeSection === 'users' && <UsersManagement />}

            {activeSection === 'debug' && (
              <div className="space-y-6">
                <InvitationDebugger />
                <AuditLogTable />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Hidden on Desktop */}
      <div className="md:hidden">
        {/* Bottom Sheet Navigation */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent 
            side="bottom" 
            className="h-[60vh] rounded-t-3xl p-0 border-t-2 dark:border-dark-border"
          >
            <div className="flex flex-col h-full">
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b dark:border-dark-border">
                <h2 className="text-xl font-semibold text-heading-primary">Admin Menu</h2>
                <p className="text-sm text-body-muted mt-1">System Administrator</p>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 overflow-y-auto px-4 py-6">
                <div className="space-y-2">
                  {[
                    { to: '/admin/dashboard', id: 'dashboard', label: 'Dashboard', description: 'View farmers overview', icon: LayoutDashboard },
                    { to: '/admin/banks', id: 'banks', label: 'Banks', description: 'Manage bank partnerships', icon: Building2 },
                    { to: '/admin/users', id: 'users', label: 'Users', description: 'Manage system users', icon: UsersIcon },
                    { to: '/admin/debug', id: 'debug', label: 'Debug', description: 'System diagnostics', icon: Bug },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        onClick={() => setMobileNavOpen(false)}
                        className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 ${
                          isActive
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 shadow-sm'
                            : 'text-foreground dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border active:bg-gray-100 dark:active:bg-dark-border/80'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          isActive 
                            ? 'bg-emerald-100 dark:bg-emerald-800/30' 
                            : 'bg-gray-100 dark:bg-dark-border'
                        }`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-body-muted mt-0.5">{item.description}</p>
                        </div>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        )}
                      </Link>
                    );
                  })}
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
            {/* Dashboard */}
            <Link
              to="/admin/dashboard"
              className={`flex flex-col items-center justify-center w-16 transition-colors ${
                activeSection === 'dashboard'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <LayoutDashboard className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">Dashboard</span>
            </Link>

            {/* Banks */}
            <Link
              to="/admin/banks"
              className={`flex flex-col items-center justify-center w-16 transition-colors ${
                activeSection === 'banks'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Building2 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">Banks</span>
            </Link>

            {/* Central FAB - Placeholder for spacing */}
            <div className="w-16" />

            {/* Users */}
            <Link
              to="/admin/users"
              className={`flex flex-col items-center justify-center w-16 transition-colors ${
                activeSection === 'users'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <UsersIcon className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">Users</span>
            </Link>

            {/* More/Debug */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center justify-center w-16 text-gray-600 dark:text-gray-400 transition-colors"
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

      {/* Page Transition Loader - Fixed Overlay */}
      {isPageTransitioning && (
        <div className="fixed inset-0 bg-white/70 dark:bg-background/70 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 dark:border-emerald-400" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;