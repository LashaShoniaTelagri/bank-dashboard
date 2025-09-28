import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { FarmersTable } from "@/components/FarmersTable";
import { BanksManagement } from "@/components/BanksManagement";
import { UsersManagement } from "@/components/UsersManagement";
import { AdminFilters } from "@/components/AdminFilters";
import { InvitationDebugger } from "@/components/InvitationDebugger";
import { ThemeToggle } from "@/components/ThemeToggle";

const AdminDashboard = () => {
  const { user, profile, signOut, loading } = useAuth();
  const location = useLocation();
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
  if (profile && profile.role !== 'admin') {

    return <Navigate to="/bank" replace />;
  }

  // If user exists but no profile, show loading or error
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
        <div className="container-fluid mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-heading-primary">TelAgri Admin</h1>
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

      <div className="relative z-10 container-fluid mx-auto px-6 py-6">
        <div className="space-y-6">
          {/* Navigation */}
          <div className="border-b border-border/30 bg-card/40 dark:bg-card/30 backdrop-blur-sm rounded-t-lg shadow-lg">
            <nav className="-mb-px flex space-x-8 p-4">
              <Link
                to="/admin/dashboard"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'dashboard'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-body-secondary hover:text-body-primary hover:border-border'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/admin/banks"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'banks'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-body-secondary hover:text-body-primary hover:border-border'
                }`}
              >
                Banks
              </Link>
              <Link
                to="/admin/users"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'users'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-body-secondary hover:text-body-primary hover:border-border'
                }`}
              >
                Users
              </Link>
              <Link
                to="/admin/debug"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'debug'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-body-secondary hover:text-body-primary hover:border-border'
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

            {activeSection === 'debug' && <InvitationDebugger />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;