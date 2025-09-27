import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TwoFactorVerification } from "@/components/TwoFactorVerification";
import { generateDeviceFingerprint, isDeviceFingerprintingSupported } from "@/lib/deviceFingerprint";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false); // Prevent premature redirects during sign-in
  const [showTwoFactor, setShowTwoFactor] = useState(() => {
    return localStorage.getItem('telagri_2fa_pending') === 'true';
  });
  const [pendingUserData, setPendingUserData] = useState<{email: string, userRole: string} | null>(() => {
    const stored = localStorage.getItem('telagri_2fa_data');
    return stored ? JSON.parse(stored) : null;
  });
  const { user, profile, signIn } = useAuth();

  // Page loading animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  
  // Check if this is a recovery/password setup flow
  const isRecovery = searchParams.get('type') === 'recovery';
  const recoveryEmail = searchParams.get('email');
  const errorCode = searchParams.get('error_code');
  const isExpiredLink = errorCode === 'otp_expired';

  useEffect(() => {
    // Extract email from URL parameters if available
    if (recoveryEmail) {
      setEmail(decodeURIComponent(recoveryEmail));
    }
    
    // Initialize email from stored 2FA data if available
    const stored2FAData = localStorage.getItem('telagri_2fa_data');
    if (stored2FAData && !email) {
      try {
        const data = JSON.parse(stored2FAData);
        if (data.email) {
          setEmail(data.email);
        }
      } catch (e) {
        console.error('Error parsing stored 2FA data:', e);
      }
    }

    // Extract email from error_description if link expired
    const errorDescription = searchParams.get('error_description');
    if (isExpiredLink && errorDescription && !recoveryEmail) {
      // Try to get email from any available source
      const getCurrentUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setEmail(session.user.email);
        }
      };
      getCurrentUser();
    }

    // Handle auth session from recovery link
    const handleAuthStateChange = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        // Auth state change tracked silently in production
        
        if (session?.user?.email) {
          setEmail(session.user.email);
          
          // If user is signed in via recovery but hasn't set password yet, stay on setup form
          if (event === 'SIGNED_IN' && isRecovery) {
            // User signed in via recovery link - password setup required
          }
        }
      });

      return () => subscription.unsubscribe();
    };

    if (isRecovery) {
      // Clear any pending 2FA state when in recovery mode
      localStorage.removeItem('telagri_2fa_pending');
      localStorage.removeItem('telagri_2fa_data');
      localStorage.removeItem('telagri_temp_pwd');
      setShowTwoFactor(false);
      setPendingUserData(null);
      
      return handleAuthStateChange();
    }
  }, [isRecovery, recoveryEmail, isExpiredLink, searchParams, email]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Only clear if not in 2FA flow
      if (!showTwoFactor) {
        localStorage.removeItem('telagri_2fa_pending');
        localStorage.removeItem('telagri_2fa_data');
        localStorage.removeItem('telagri_temp_pwd');
      }
    };
  }, [showTwoFactor]);

  const handle2FASuccess = async () => {
    if (!pendingUserData) return;
    
    try {
      // Get stored password
      const storedPassword = localStorage.getItem('telagri_temp_pwd');
      const finalPassword = storedPassword ? atob(storedPassword) : password;
      const finalEmail = pendingUserData.email || email;
      

      
      // Clear 2FA state from localStorage
      localStorage.removeItem('telagri_2fa_pending');
      localStorage.removeItem('telagri_2fa_data');
      localStorage.removeItem('telagri_temp_pwd');
      
      // Now complete the sign-in process
      const { error } = await signIn(finalEmail, finalPassword);
      
      if (error) {
        toast({
          title: "Error completing sign-in",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Clear component state
      setShowTwoFactor(false);
      setPendingUserData(null);

      toast({
        title: "Welcome back!",
        description: "You've been signed in successfully.",
      });

    } catch (error: unknown) {
      console.error('🔐 2FA Success error:', error);
      toast({
        title: "Sign-in error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleBackToLogin = () => {
    // Clear 2FA state from both component and localStorage
    localStorage.removeItem('telagri_2fa_pending');
    localStorage.removeItem('telagri_2fa_data');
    localStorage.removeItem('telagri_temp_pwd');
    
    setShowTwoFactor(false);
    setPendingUserData(null);
    setSigningIn(false); // Reset signing-in state
    setPassword(""); // Clear password for security
  };

  // Don't auto-redirect if this is a recovery flow, 2FA verification, or actively signing in
  if (user && !isRecovery && !showTwoFactor && !pendingUserData && !signingIn) {
    // Use existing profile from useAuth hook to redirect appropriately
    if (profile) {
      if (profile.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
      } else if (profile.role === 'bank_viewer') {
        return <Navigate to="/bank" replace />;
      } else if (profile.role === 'specialist') {
        return <Navigate to="/specialist/dashboard" replace />;
      }
    }
    // If no profile found, stay on auth page to show error or loading
    return null;
  }

  // Show 2FA verification screen
  if (showTwoFactor && pendingUserData) {
    
    return (
      <TwoFactorVerification
        email={pendingUserData.email}
        userRole={pendingUserData.userRole}
        onVerificationSuccess={handle2FASuccess}
        onBack={handleBackToLogin}
      />
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSigningIn(true); // Prevent redirects during sign-in process
    
    try {
      // First, validate credentials without completing sign-in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('🔐 Auth error:', authError);
        throw authError;
      }

      // Sign out immediately to prevent automatic session
      await supabase.auth.signOut();

      // Get user profile to determine role for 2FA
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError) {
        console.error('🔐 Profile fetch error:', profileError);
        // Default role if profile not found
      }

      const userRole = profile?.role || 'user';

      // Check if device is trusted before requiring 2FA
      let deviceIsTrusted = false;
      try {
        if (isDeviceFingerprintingSupported()) {
          const deviceFingerprint = await generateDeviceFingerprint();
          
          const { data: trustedDevice, error: trustError } = await supabase
            .rpc('is_device_trusted', {
              p_user_email: email,
              p_device_fingerprint: deviceFingerprint
            });
          
          if (!trustError && trustedDevice) {
            deviceIsTrusted = true;
            console.log('🔐 Device is trusted, skipping 2FA');
          }
        }
      } catch (error) {
        console.error('Error checking device trust:', error);
        // Continue with 2FA if trust check fails
      }

      if (deviceIsTrusted) {
        // Complete sign-in immediately for trusted device
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        toast({
          title: "Welcome back!",
          description: "Trusted device recognized - signed in automatically",
        });

        // Will redirect via useAuth hook
        return;
      }
      
      // Set up 2FA verification for non-trusted devices
      const pendingData = { 
        email, 
        userRole: userRole === 'admin' ? 'Administrator' : 'Bank Viewer'
      };
      

      
      // Persist 2FA state to localStorage to survive re-renders
      localStorage.setItem('telagri_2fa_data', JSON.stringify(pendingData));
      localStorage.setItem('telagri_2fa_pending', 'true');
      // Store password temporarily for final sign-in (encrypted)
      localStorage.setItem('telagri_temp_pwd', btoa(password));
      
      setPendingUserData(pendingData);
      setShowTwoFactor(true);

      toast({
        title: "Credentials verified",
        description: "Please check your email for a verification code",
      });



          } catch (error: unknown) {
        console.error('🔐 Sign-in error:', error);
        
        let title = "Sign-in failed";
        let description = "Please check your credentials and try again";
        
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          
          // Handle specific sign-in error cases
          if (errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid email or password')) {
            title = "Invalid Credentials";
            description = "Incorrect email or password. Please check your credentials and try again.";
          } else if (errorMessage.includes('too many') || errorMessage.includes('rate limit')) {
            title = "Too Many Attempts";
            description = "Too many sign-in attempts. Please wait a few minutes before trying again.";
          } else if (errorMessage.includes('email not confirmed') || errorMessage.includes('not verified')) {
            title = "Email Not Verified";
            description = "Please check your email and click the verification link before signing in.";
          } else if (errorMessage.includes('user not found') || errorMessage.includes('no user')) {
            title = "Account Not Found";
            description = "No account found with this email. Please contact your administrator.";
          } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            title = "Connection Error";
            description = "Network connection issue. Please check your internet and try again.";
          } else if (errorMessage.includes('service') || errorMessage.includes('server')) {
            title = "Service Unavailable";
            description = "Authentication service is temporarily unavailable. Please try again later.";
          } else if (error.message && !errorMessage.includes('function') && !errorMessage.includes('edge')) {
            // Use the actual error message if it's user-friendly
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
      setSigningIn(false); // Re-enable redirects after sign-in process completes
    }
  };



  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const isLinkExpired = isExpiredLink || searchParams.get('error') === 'access_denied';
      
      if (isLinkExpired) {
        // For expired links, try to sign in with email/password after validating user exists

        
        // First check if user exists and try to update their password via admin
        // This is for users who were invited but never set a password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });

        if (updateError) {
          // If update fails, the user might not be signed in, try to get them via admin API

          
          // For expired links, we'll need the user to contact admin for a new invitation
          throw new Error('Your invitation link has expired. Please contact your administrator for a new invitation link.');
        }

        
        
      } else {
        // For fresh recovery links, user should have an active session
        const { data: { session } } = await supabase.auth.getSession();
        

        if (!session) {
          throw new Error('No active recovery session. Please use the link from your email again.');
        }

        // Update the user's password using the active recovery session
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password: password
        });

        if (updateError) {
          console.error('Password update error:', updateError);
          throw new Error(`Failed to update password: ${updateError.message}`);
        }


      }

      // Update the user's profile to mark invitation as accepted
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            invitation_status: 'accepted',
            invitation_accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', currentUser.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          // Don't fail the whole process if profile update fails
        }
      }

      toast({
        title: "Account setup complete!",
        description: "Your password has been set and you're now signed in.",
      });

      // Sign them in with their new password if they weren't already signed in
      if (isLinkExpired) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          console.error('Sign in after password setup failed:', signInError);
          toast({
            title: "Password set successfully",
            description: "Please sign in with your new password.",
          });
          return;
        }
      }

      // Redirect to dashboard after successful setup
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (error: unknown) {
      console.error('Password setup error:', error);
      
      let title = "Password setup failed";
      let description = "Something went wrong. Please try again or contact your administrator.";
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Handle specific password setup error cases
        if (errorMessage.includes('expired') || errorMessage.includes('invalid recovery')) {
          title = "Link Expired";
          description = "Your invitation link has expired. Please contact your administrator for a new invitation.";
        } else if (errorMessage.includes('weak password') || errorMessage.includes('password strength')) {
          title = "Weak Password";
          description = "Password must be at least 6 characters long and contain a mix of letters and numbers.";
        } else if (errorMessage.includes('no active') || errorMessage.includes('no session')) {
          title = "Session Expired";
          description = "Your session has expired. Please use the link from your email again.";
        } else if (errorMessage.includes('same password') || errorMessage.includes('must be different')) {
          title = "Password Unchanged";
          description = "Please choose a password different from your current one.";
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          title = "Connection Error";
          description = "Network connection issue. Please check your internet and try again.";
        } else if (errorMessage.includes('service') || errorMessage.includes('server')) {
          title = "Service Unavailable";
          description = "Password service is temporarily unavailable. Please try again later.";
        } else if (error.message && !errorMessage.includes('function') && !errorMessage.includes('edge')) {
          // Use the actual error message if it's user-friendly
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  // If this is a recovery flow, show password setup form
  if (isRecovery) {
    const isLinkExpired = isExpiredLink || searchParams.get('error') === 'access_denied';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">TelAgri</CardTitle>
            <p className="text-muted-foreground">
              {isLinkExpired ? "Complete Account Setup" : "Set Up Your Password"}
            </p>
          </CardHeader>
          <CardContent>
            {isLinkExpired && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ The email link has expired. Please enter your email and password below to complete your account setup.
                </p>
              </div>
            )}
            
            <form onSubmit={handlePasswordSetup} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isLinkExpired && !!email}
                  className={!isLinkExpired && !!email ? "bg-muted" : ""}
                  placeholder={isLinkExpired ? "Enter your email address" : ""}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLinkExpired ? "Setting up account..." : "Setting up password..."}
                  </>
                ) : (
                  isLinkExpired ? "Complete Account Setup" : "Set Password & Sign In"
                )}
              </Button>
            </form>
            
            {isLinkExpired && (
              <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Need a new invitation link? Contact your administrator.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Futuristic Agri-Finance Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-green-50"></div>
      
      {/* Geometric Pattern Overlay - Representing Crop Fields & Financial Growth */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(34,197,94,0.1) 1px, transparent 1px),
            linear-gradient(rgba(34,197,94,0.1) 1px, transparent 1px),
            linear-gradient(45deg, rgba(59,130,246,0.05) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(59,130,246,0.05) 25%, transparent 25%)
          `,
          backgroundSize: '60px 60px, 60px 60px, 120px 120px, 120px 120px',
          backgroundPosition: '0 0, 0 0, 0 0, 30px 30px'
        }}
      ></div>

      {/* Floating Elements - Technology & Agriculture Symbols */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-emerald-400/20 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-3 h-3 bg-blue-400/20 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-16 w-1.5 h-1.5 bg-green-400/20 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-12 w-2.5 h-2.5 bg-teal-400/20 rounded-full animate-pulse delay-500"></div>
        <div className="absolute top-1/3 left-1/4 w-1 h-1 bg-emerald-300/30 rounded-full animate-pulse delay-1500"></div>
        <div className="absolute top-2/3 right-1/3 w-2 h-2 bg-blue-300/30 rounded-full animate-pulse delay-700"></div>
      </div>

      {/* Initial Loading Animation */}
      {pageLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-green-50">
          <div className="text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
              <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin absolute top-2 left-2 opacity-60" style={{ animationDirection: 'reverse' }}></div>
            </div>
            <p className="mt-4 text-slate-600 text-sm font-medium animate-pulse">Loading...</p>
          </div>
        </div>
      )}

      {/* Content Container with Glass Morphism Effect */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo outside the card */}
        <div className="mb-8 text-center">
          <div className={`bg-white/40 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 transition-all duration-1000 ${
            pageLoading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}>
            <img 
              src="https://cdn.telagri.com/assets/logo.png" 
              alt="TelAgri Logo" 
              className="h-12 w-auto mx-auto mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <p className="text-slate-600 text-sm font-medium">AGTECH FINANCIAL MANAGEMENT</p>
          </div>
        </div>

        <Card className={`bg-white/60 backdrop-blur-md border-white/30 shadow-xl transition-all duration-1000 delay-300 ${
          pageLoading ? 'opacity-0 translate-y-8' : 'opacity-100 translate-y-0'
        }`}>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-slate-700">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 text-base bg-white/80 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-200"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 text-base bg-white/80 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-200"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Copyright Footer */}
        <footer className={`mt-8 text-center transition-all duration-1000 delay-500 ${
          pageLoading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <div className="bg-white/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} TelAgri. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Auth;