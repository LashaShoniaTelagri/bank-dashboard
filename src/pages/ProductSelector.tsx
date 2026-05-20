import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Leaf, FileText, ArrowRight, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "@/components/ui/use-toast";
import { hasProductAccess, ProductAccess, getEnabledProducts } from "@/types/productAccess";

interface Bank {
  id: string;
  name: string;
  logo_url: string;
}

const PRODUCT_CARDS = [
  {
    product: ProductAccess.FieldMonitoring,
    title: "Field Monitoring",
    description: "Track farmer performance, view F-100 agricultural assessment reports, and monitor loan portfolio health across your bank's farmers.",
    icon: Leaf,
    iconColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    hoverBorder: "hover:border-green-400 dark:hover:border-green-600",
    route: "/bank",
  },
  {
    product: ProductAccess.Underwriting,
    title: "Underwriting",
    description: "Submit land parcels for credit risk assessment, score applications, and analyze underwriting trends for agricultural lending decisions.",
    icon: FileText,
    iconColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    hoverBorder: "hover:border-blue-400 dark:hover:border-blue-600",
    route: "/underwriting/applications",
  },
];

export const ProductSelector = () => {
  const { user, profile, signOut, loading } = useAuth();
  const userProfile = profile as UserProfile | null;
  const navigate = useNavigate();
  const [bank, setBank] = useState<Bank | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Session Expired",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && userProfile) {
      if (userProfile.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
        return;
      }

      const enabledProducts = getEnabledProducts(userProfile.products_enabled ?? 0);
      if (enabledProducts.length === 1) {
        if (enabledProducts[0] === ProductAccess.Underwriting) {
          navigate("/underwriting/applications", { replace: true });
        } else {
          navigate("/bank", { replace: true });
        }
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

  const productsEnabled = userProfile?.products_enabled ?? 1;
  const availableProducts = PRODUCT_CARDS.filter((card) =>
    hasProductAccess(productsEnabled, card.product)
  );

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
            {bank?.logo_url && (
              <img src={bank.logo_url} alt={`${bank.name} logo`} className="h-10 w-auto" />
            )}
            <h1 className="text-2xl font-bold text-heading-primary">
              {bank?.name || "TelAgri"}
            </h1>
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
      </header>

      <main className="relative z-10 container mx-auto px-4 py-12">
        {availableProducts.length === 0 ? (
          <div className="max-w-lg mx-auto text-center">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardContent className="pt-10 pb-10 px-8">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">No Products Activated</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Your account has been created but no products have been enabled yet. Please contact your organization's administrator or reach out to TelAgri to activate product access for your account.
                </p>
                <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground mb-6">
                  <p className="font-medium text-foreground mb-1">Need help?</p>
                  <p>Contact us at <a href="mailto:support@telagri.com" className="text-primary hover:underline">support@telagri.com</a></p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => signOut()}
                  className="hover:bg-muted dark:hover:bg-muted/80"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="max-w-3xl mx-auto text-center mb-10">
              <h2 className="text-3xl font-bold text-foreground mb-3">Welcome back</h2>
              <p className="text-muted-foreground text-lg">
                Select a product to get started
              </p>
            </div>

            <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableProducts.map((card) => (
                <Card
                  key={card.product}
                  className={`group cursor-pointer border-2 ${card.borderColor} ${card.hoverBorder} bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
                  onClick={() => navigate(card.route)}
                >
                  <CardContent className="pt-8 pb-8 px-6">
                    <div className={`w-14 h-14 rounded-xl ${card.bgColor} flex items-center justify-center mb-5`}>
                      <card.icon className={`h-7 w-7 ${card.iconColor}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                      {card.description}
                    </p>
                    <div className="flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all duration-200">
                      <span>Open {card.title}</span>
                      <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ProductSelector;
