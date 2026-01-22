import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, Shield } from "lucide-react";

interface PasswordResetToken {
  id: string;
  email: string;
  token: string;
  user_id: string;
  type: string;
  expires_at: string;
  status: string;
  clicks_count: number;
  last_clicked_at: string | null;
  completed_at: string | null;
}

const PasswordResetAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [resetToken, setResetToken] = useState<PasswordResetToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validateResetToken = async () => {
      if (!token) {
        setError('Invalid password reset link - No token provided');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Validating password reset token:', token.substring(0, 10) + '...');

        // Validate token and get reset details
        // Note: Check type if column exists, otherwise check role is NULL
        const { data, error: fetchError } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (fetchError) {
          console.error('❌ Database error:', fetchError);
          setError('Failed to validate password reset token');
          setLoading(false);
          return;
        }

        if (!data) {
          console.error('❌ Token not found');
          setError('Password reset token not found or invalid');
          setLoading(false);
          return;
        }

        // Validate it's a password reset token (not an invitation)
        // Check: either type='password_reset' OR (type is NULL/missing AND role is NULL)
        const isPasswordReset = data.type === 'password_reset' || (!data.type && !data.role);
        
        if (!isPasswordReset) {
          console.error('❌ Token is not a password reset (it\'s an invitation)');
          setError('This is an invitation link, not a password reset link. Please use the correct link.');
          setLoading(false);
          return;
        }

        console.log('✅ Password reset token found:', {
          email: data.email,
          type: data.type || 'password_reset (inferred)',
          status: data.status,
          expires_at: data.expires_at,
          clicks: data.clicks_count
        });

        // Check if expired
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        
        if (expiresAt < now) {
          console.error('❌ Password reset token expired:', {
            expires_at: expiresAt,
            now: now
          });
          
          setError(`This password reset link expired on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}. Please request a new password reset link.`);
          
          // Update status in database if not already expired
          if (data.status !== 'expired') {
            await supabase
              .from('invitations')
              .update({ status: 'expired' })
              .eq('token', token);
          }
          
          setLoading(false);
          return;
        }

        // Check if already completed
        if (data.status === 'completed') {
          console.warn('⚠️ Password reset already used');
          setError('This password reset link has already been used. Please sign in with your new password or request a new reset link if needed.');
          setLoading(false);
          return;
        }

        // Check if cancelled
        if (data.status === 'cancelled') {
          console.warn('⚠️ Password reset cancelled');
          setError('This password reset link has been cancelled.');
          setLoading(false);
          return;
        }

        // Track click
        console.log('📊 Recording password reset link click');
        const { error: updateError } = await supabase
          .from('invitations')
          .update({ 
            clicks_count: data.clicks_count + 1,
            last_clicked_at: new Date().toISOString()
          })
          .eq('token', token);

        if (updateError) {
          console.warn('⚠️ Failed to update click count:', updateError);
        }

        setResetToken(data);
        setLoading(false);
        console.log('✅ Password reset token validated successfully');
      } catch (err: any) {
        console.error('❌ Password reset validation error:', err);
        setError('Failed to validate password reset token: ' + err.message);
        setLoading(false);
      }
    };

    validateResetToken();
  }, [token]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetToken) return;

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      console.log('🔐 Resetting password for user:', resetToken.user_id);

      // Call Edge Function to complete password reset
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/complete-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          token: token,
          password: password
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('❌ Password reset failed:', result.error);
        throw new Error(result.error || 'Failed to reset password');
      }

      console.log('✅ Password reset successfully');

      // Sign in the user with new password
      console.log('🔑 Signing in user...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: resetToken.email,
        password: password
      });

      if (signInError) {
        console.error('❌ Sign in failed:', signInError);
        throw signInError;
      }

      console.log('✅ User signed in successfully');

      toast({
        title: "Success!",
        description: "Your password has been reset. Redirecting...",
      });

      // Redirect to root - Auth page will handle role-based routing
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (err: any) {
      console.error('❌ Password reset error:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to reset password. Please try again or request a new reset link.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Validating your password reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    const isExpired = error.includes('expired');
    const isAlreadyUsed = error.includes('already been used');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">TelAgri</CardTitle>
            <p className="text-muted-foreground">Password Reset</p>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-6 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg">
              <div className="flex justify-center mb-4">
                {isExpired ? (
                  <Clock className="h-16 w-16 text-destructive" />
                ) : isAlreadyUsed ? (
                  <CheckCircle className="h-16 w-16 text-destructive" />
                ) : (
                  <XCircle className="h-16 w-16 text-destructive" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-destructive mb-2">
                {isExpired ? 'Reset Link Expired' : isAlreadyUsed ? 'Already Used' : 'Invalid Reset Link'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </div>
            
            <div className="space-y-2">
              {isAlreadyUsed ? (
                <Button 
                  onClick={() => navigate('/auth')}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Go to Login
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={() => navigate('/forgot-password')}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    Request New Reset Link
                  </Button>
                  <Button 
                    onClick={() => navigate('/auth')}
                    variant="outline"
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main password reset form
  const expiresAt = resetToken ? new Date(resetToken.expires_at) : null;
  const hoursRemaining = expiresAt 
    ? Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60)) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">TelAgri</CardTitle>
          <p className="text-muted-foreground">Reset Your Password</p>
        </CardHeader>
        <CardContent>
          {/* Reset Details */}
          <div className="mb-6 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{resetToken?.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Link expires in:</span>
              <span className={`font-medium ${hoursRemaining <= 1 ? 'text-destructive' : 'text-primary'}`}>
                {hoursRemaining} hour{hoursRemaining !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <RefreshCw className="h-3 w-3" />
              <span>You can revisit this link anytime within 24 hours</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Link clicked {resetToken?.clicks_count || 0} time{resetToken?.clicks_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Password Reset Form */}
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">New Password</label>
              <Input
                type="password"
                placeholder="Enter your new password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={submitting}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Confirm Password</label>
              <Input
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={submitting}
                className="h-11"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]" 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting your password...
                </>
              ) : (
                "Reset Password & Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => navigate('/auth')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel and go to login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordResetAccept;
