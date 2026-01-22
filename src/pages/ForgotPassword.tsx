import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call custom Edge Function to send branded password reset email via SendGrid
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email }
      });

      if (error) {
        console.error('🔐 Password reset error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send reset email');
      }

      // Show success message
      setEmailSent(true);
      
      toast({
        title: "Reset Link Sent",
        description: "Check your email for password reset instructions",
      });

    } catch (error: unknown) {
      console.error('🔐 Password reset request error:', error);
      
      let title = "Request Failed";
      let description = "Unable to send reset link. Please try again.";
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('not found') || errorMessage.includes('no user')) {
          title = "Email Not Found";
          description = "No account exists with this email. Please contact your administrator.";
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          title = "Too Many Requests";
          description = "Please wait a few minutes before requesting another reset link.";
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          title = "Connection Error";
          description = "Please check your internet connection and try again.";
        } else if (error.message && !errorMessage.includes('function')) {
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 bg-background transition-colors">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle variant="icon" size="sm" />
        </div>

        {/* Background - Same as Auth page */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-primary/10 dark:via-accent/10 dark:to-primary/20"></div>
      
        {/* Geometric Pattern Overlay */}
        <div className="absolute inset-0 opacity-20 dark:opacity-20">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px),
                linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
                linear-gradient(45deg, hsl(var(--accent) / 0.05) 25%, transparent 25%),
                linear-gradient(-45deg, hsl(var(--accent) / 0.05) 25%, transparent 25%)
              `,
              backgroundSize: '60px 60px, 60px 60px, 120px 120px, 120px 120px',
              backgroundPosition: '0 0, 0 0, 0 0, 30px 30px'
            }}
          />
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-2 h-2 bg-emerald-400/30 dark:bg-primary/30 rounded-full animate-pulse"></div>
          <div className="absolute top-40 right-20 w-3 h-3 bg-green-400/30 dark:bg-accent/30 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute bottom-32 left-16 w-1.5 h-1.5 bg-emerald-500/25 dark:bg-primary/30 rounded-full animate-pulse delay-2000"></div>
          <div className="absolute bottom-20 right-12 w-2.5 h-2.5 bg-green-500/25 dark:bg-accent/30 rounded-full animate-pulse delay-500"></div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 border border-white/20 dark:border-white/10 ring-1 ring-white/10 dark:ring-white/5">
              <img 
                src="https://cdn.telagri.com/assets/logo.png" 
                alt="TelAgri Logo" 
                className="h-12 w-auto mx-auto mb-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-foreground/70 text-sm font-medium">PASSWORD RECOVERY</p>
            </div>
          </div>

          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10 ring-1 ring-white/10 dark:ring-white/5 shadow-2xl shadow-black/10 dark:shadow-black/40">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-semibold text-heading-secondary">
                {emailSent ? "Check Your Email" : "Forgot Password?"}
              </CardTitle>
              <CardDescription className="text-foreground/60">
                {emailSent 
                  ? "We've sent password reset instructions to your email"
                  : "Enter your email address and we'll send you a link to reset your password"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full p-4">
                      <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-center text-foreground/80 mb-2">
                      Password reset link sent to:
                    </p>
                    <p className="text-center font-medium text-foreground">
                      {email}
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-foreground/80">
                      <strong>Next Steps:</strong>
                    </p>
                    <ul className="text-sm text-foreground/70 mt-2 space-y-1 list-disc list-inside">
                      <li>Check your email inbox</li>
                      <li>Click the reset link (valid for 24 hours)</li>
                      <li>You can revisit the link multiple times if needed</li>
                      <li>Set your new password</li>
                      <li>Sign in with your new password</li>
                    </ul>
                  </div>

                  <div className="text-center text-sm text-foreground/60">
                    Didn't receive the email? Check your spam folder or{" "}
                    <button
                      onClick={() => {
                        setEmailSent(false);
                        setEmail("");
                      }}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                    >
                      try again
                    </button>
                  </div>

                  <Link to="/auth">
                    <Button 
                      variant="outline" 
                      className="w-full bg-white/20 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 hover:bg-white/30 dark:hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground/80 mb-2 block">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-foreground/40" />
                      <Input
                        type="email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 h-12 text-base bg-white/20 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 focus:border-emerald-400/60 focus:ring-emerald-400/20 focus:bg-white/25 dark:focus:bg-white/8 placeholder:text-foreground/60"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium backdrop-blur-sm shadow-xl shadow-emerald-500/25 border border-emerald-400/30 hover:shadow-2xl hover:shadow-emerald-400/40 transform transition-all duration-200 hover:scale-[1.02]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Reset Link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <Link to="/auth">
                    <Button 
                      type="button"
                      variant="ghost" 
                      className="w-full hover:bg-white/20 dark:hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Sign In
                    </Button>
                  </Link>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-lg px-4 py-3 border border-white/20 dark:border-white/10">
              <p className="text-xs text-foreground/60">
                🔒 Password reset links expire after 24 hours for security
              </p>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default ForgotPassword;

