import { useEffect, useState } from "react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, FileText, Send, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "@/components/ui/use-toast";
import { hasProductAccess } from "@/types/productAccess";
import { ProductAccess } from "@/types/productAccess";

interface Bank {
  id: string;
  name: string;
  logo_url: string;
}

interface UnderwritingLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const UnderwritingLayout = ({ children, title }: UnderwritingLayoutProps) => {
  const { user, profile, signOut, loading } = useAuth();
  const userProfile = profile as UserProfile | null;
  const navigate = useNavigate();
  const location = useLocation();
  const [bank, setBank] = useState<Bank | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please log in again to continue.",
        variant: "destructive",
      });
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && userProfile) {
      if (!hasProductAccess(userProfile.products_enabled, ProductAccess.Underwriting) && userProfile.role !== 'admin') {
        toast({
          title: "Access Denied",
          description: "You don't have access to the Underwriting module.",
          variant: "destructive",
        });
        navigate("/bank", { replace: true });
      }
    }
  }, [user, userProfile, loading, navigate]);

  useEffect(() => {
    const fetchBank = async () => {
      if (userProfile?.bank_id) {
        const { data } = await supabase
          .from("banks")
          .select("*")
          .eq("id", userProfile.bank_id)
          .maybeSingle();
        if (data) setBank(data);
      }
    };
    fetchBank();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const navItems = [
    { path: "/underwriting/submit", label: "Submit Application", icon: Send },
    { path: "/underwriting/applications", label: "Applications", icon: FileText },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-background transition-colors">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-primary/10 dark:via-accent/10 dark:to-primary/20" />

      <div className="absolute inset-0 opacity-20 dark:opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, hsl(var(--accent) / 0.3) 0%, transparent 50%),
              radial-gradient(circle at 40% 80%, hsl(var(--primary) / 0.3) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      <header className="relative z-10 border-b bg-card/60 dark:bg-card/40 backdrop-blur-md border-border/30 shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!userProfile) {
                  navigate("/products");
                  return;
                }
                if (userProfile.role === "admin") {
                  navigate("/admin/dashboard");
                  return;
                }
                if (userProfile.role === "specialist") {
                  navigate("/specialist");
                  return;
                }
                const products = userProfile.products_enabled ?? 0;
                const hasFM = hasProductAccess(products, ProductAccess.FieldMonitoring);
                const hasUW = hasProductAccess(products, ProductAccess.Underwriting);
                if (hasFM && hasUW) {
                  navigate("/products");
                } else if (hasFM) {
                  navigate("/bank");
                } else {
                  navigate("/products");
                }
              }}
              className="hover:bg-muted dark:hover:bg-muted/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {bank?.logo_url && (
              <img src={bank.logo_url} alt={`${bank.name} logo`} className="h-10 w-auto" />
            )}
            <div>
              <h1 className="text-xl font-bold text-heading-primary">{title}</h1>
              <p className="text-sm text-muted-foreground">{bank?.name || "TelAgri"} - Underwriting</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle variant="icon" size="sm" />
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="hidden md:flex bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium border-emerald-400/30 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-400/40 transform transition-all duration-200 hover:scale-105"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
};
