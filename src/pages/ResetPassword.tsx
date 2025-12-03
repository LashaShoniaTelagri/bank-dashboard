import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidLink, setIsValidLink] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Validate the reset link on component mount
  useEffect(() => {
    const validateResetLink = async () => {
      try {
        // Check if this is a recovery flow
        const type = searchParams.get('type');
        const errorCode = searchParams.get('error_code');
        
        if (errorCode === 'otp_expired') {
          toast({
            title: "Link Expired",
            description: "This password reset link has expired. Please request a new one.",
            variant: "destructive",
          });
          setIsValidLink(false);
          setIsValidating(false);
          return;
        }

        if (type === 'recovery') {
          // Valid recovery link
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            setIsValidLink(true);
          } else {
            toast({
              title: "Invalid Link",
              description: "This password reset link is invalid or has expired.",
              variant: "destructive",
            });
            setIsValidLink(false);
          }
        } else {
          // Not a recovery link
          setIsValidLink(false);
        }
      } catch (error) {
        console.error('🔐 Link validation error:', error);
        setIsValidLink(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateResetLink();
  }, [searchParams]);

  const validatePasswordStrength = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) {
      return { valid: false, message: "Password must be at least 8 characters long" };
    }
    if (!/[A-Z]/.test(pwd)) {
      return { valid: false, message: "Password must contain at least one uppercase letter" };
    }
    if (!/[a-z]/.test(pwd)) {
      return { valid: false, message: "Password must contain at least one lowercase letter" };
    }
    if (!/[0-9]/.test(pwd)) {
      return { valid: false, message: "Password must contain at least one number" };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password match
    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are identical",
        variant: "destructive",
      });
      return;
    }

    // Validate password strength
    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.valid) {
      toast({
        title: "Weak Password",
        description: strengthCheck.message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update the user's password using the active recovery session
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('🔐 Password update error:', error);
        throw error;
      }

      // Update profile to mark any invitation as accepted
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({
            invitation_status: 'accepted',
            invitation_accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      }

      setResetSuccess(true);

      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. Redirecting to sign in...",
      });

      // Redirect to sign in page after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (error: unknown) {
      console.error('🔐 Password reset error:', error);
      
      let title = "Reset Failed";
      let description = "Unable to reset password. Please try again.";
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('same password') || errorMessage.includes('must be different')) {
          title = "Password Unchanged";
          description = "Please choose a password different from your current one.";
        } else if (errorMessage.includes('weak') || errorMessage.includes('strength')) {
          title = "Weak Password";
          description = "Password must be stronger. Include uppercase, lowercase, numbers.";
        } else if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
          title = "Link Expired";
          description = "Your reset link has expired. Please request a new one.";
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

  // Show loading state while validating link
  if (isValidating) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-foreground/60">Validating reset link...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Show error if link is invalid
  if (!isValidLink) {
    return (
      <ThemeProvider>
        <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 bg-background">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-primary/10 dark:via-accent/10 dark:to-primary/20"></div>
          
          <div className="relative z-10 w-full max-w-md">
            <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full p-4 w-fit">
                  <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-xl font-semibold text-heading-secondary">Invalid Reset Link</CardTitle>
                <CardDescription className="text-foreground/60">
                  This password reset link is invalid or has expired
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-sm text-foreground/70">
                  Password reset links expire after 1 hour for security reasons.
                </p>
                <Button 
                  onClick={() => navigate('/forgot-password')}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500"
                >
                  Request New Reset Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/auth')}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 bg-background transition-colors">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle variant="icon" size="sm" />
        </div>

        {/* Background */}
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

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-6 shadow-2xl shadow-black/10 dark:shadow-black/30 border border-white/20 dark:border-white/10">
              <img 
                src="https://cdn.telagri.com/assets/logo.png" 
                alt="TelAgri Logo" 
                className="h-12 w-auto mx-auto mb-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-foreground/70 text-sm font-medium">SET NEW PASSWORD</p>
            </div>
          </div>

          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/20 dark:border-white/10 ring-1 ring-white/10 dark:ring-white/5 shadow-2xl shadow-black/10 dark:shadow-black/40">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-semibold text-heading-secondary">
                {resetSuccess ? "Password Reset Complete" : "Create New Password"}
              </CardTitle>
              <CardDescription className="text-foreground/60">
                {resetSuccess 
                  ? "Your password has been successfully updated"
                  : "Choose a strong password for your TelAgri account"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSuccess ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full p-4">
                    <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-center text-foreground/80 mb-2">
                    Redirecting to sign in...
                  </p>
                  <Loader2 className="h-6 w-6 animate-spin text-primary mt-2" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground/80 mb-2 block">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-foreground/40" />
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="pl-10 h-12 text-base bg-white/20 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 focus:border-emerald-400/60 focus:ring-emerald-400/20"
                      />
                    </div>
                    <p className="text-xs text-foreground/60 mt-1">
                      At least 8 characters with uppercase, lowercase, and numbers
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground/80 mb-2 block">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-foreground/40" />
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="pl-10 h-12 text-base bg-white/20 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/10 focus:border-emerald-400/60 focus:ring-emerald-400/20"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-xs text-foreground/80 font-medium mb-2">
                      Password Requirements:
                    </p>
                    <ul className="text-xs text-foreground/70 space-y-1">
                      <li className="flex items-center">
                        <span className={password.length >= 8 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/40"}>
                          {password.length >= 8 ? "✓" : "○"}
                        </span>
                        <span className="ml-2">At least 8 characters</span>
                      </li>
                      <li className="flex items-center">
                        <span className={/[A-Z]/.test(password) ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/40"}>
                          {/[A-Z]/.test(password) ? "✓" : "○"}
                        </span>
                        <span className="ml-2">One uppercase letter</span>
                      </li>
                      <li className="flex items-center">
                        <span className={/[a-z]/.test(password) ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/40"}>
                          {/[a-z]/.test(password) ? "✓" : "○"}
                        </span>
                        <span className="ml-2">One lowercase letter</span>
                      </li>
                      <li className="flex items-center">
                        <span className={/[0-9]/.test(password) ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/40"}>
                          {/[0-9]/.test(password) ? "✓" : "○"}
                        </span>
                        <span className="ml-2">One number</span>
                      </li>
                    </ul>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-medium shadow-xl shadow-emerald-500/25 transform transition-all duration-200 hover:scale-[1.02]" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Security Notice */}
          {!resetSuccess && (
            <div className="mt-6 text-center">
              <div className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-lg px-4 py-3 border border-white/20 dark:border-white/10">
                <p className="text-xs text-foreground/60">
                  🔒 Your password will be encrypted and stored securely
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default ResetPassword;

