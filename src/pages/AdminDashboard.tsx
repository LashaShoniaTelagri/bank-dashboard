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
        <div className="container-fluid mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-700">TelAgri Admin</h1>
          <Button variant="outline" onClick={handleSignOut} className="border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg active:scale-95 transform transition-all duration-300 hover:scale-105 shadow-md">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="relative z-10 container-fluid mx-auto px-6 py-6">
        <div className="space-y-6">
          {/* Navigation */}
          <div className="border-b border-white/30 bg-white/40 backdrop-blur-sm rounded-t-lg shadow-lg">
            <nav className="-mb-px flex space-x-8 p-4">
              <Link
                to="/admin/dashboard"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'dashboard'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/admin/banks"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'banks'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Banks
              </Link>
              <Link
                to="/admin/users"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'users'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Users
              </Link>
              <Link
                to="/admin/debug"
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeSection === 'debug'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Debug
              </Link>
            </nav>
          </div>

          {/* Content */}
          <div className="bg-white/60 backdrop-blur-md border border-white/30 rounded-b-lg shadow-xl p-6">
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