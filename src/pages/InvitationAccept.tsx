import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  token: string;
  user_id: string;
  role: string;
  bank_id: string | null;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  status: string;
  clicks_count: number;
  last_clicked_at: string | null;
  completed_at: string | null;
}

const InvitationAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bankName, setBankName] = useState<string>('');

  useEffect(() => {
    const validateInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link - No token provided');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Validating invitation token:', token.substring(0, 10) + '...');

        // Validate token and get invitation details
        const { data, error: fetchError } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (fetchError) {
          console.error('❌ Database error:', fetchError);
          setError('Failed to validate invitation');
          setLoading(false);
          return;
        }

        if (!data) {
          console.error('❌ Invitation not found');
          setError('Invitation not found or invalid token');
          setLoading(false);
          return;
        }

        console.log('✅ Invitation found:', {
          email: data.email,
          status: data.status,
          expires_at: data.expires_at,
          clicks: data.clicks_count
        });

        // Check if expired
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        
        if (expiresAt < now) {
          console.error('❌ Invitation expired:', {
            expires_at: expiresAt,
            now: now
          });
          
          setError(`This invitation expired on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}. Please contact your administrator for a new invitation.`);
          
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
          console.warn('⚠️ Invitation already used');
          setError('This invitation has already been used. Please sign in with your credentials.');
          setLoading(false);
          return;
        }

        // Check if cancelled
        if (data.status === 'cancelled') {
          console.warn('⚠️ Invitation cancelled');
          setError('This invitation has been cancelled. Please contact your administrator.');
          setLoading(false);
          return;
        }

        // Track click
        console.log('📊 Recording invitation click');
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

        // Fetch bank name if role requires bank
        if (data.bank_id) {
          const { data: bankData } = await supabase
            .from('banks')
            .select('name')
            .eq('id', data.bank_id)
            .single();
          
          if (bankData) {
            setBankName(bankData.name);
          }
        }

        setInvitation(data);
        setLoading(false);
        console.log('✅ Invitation validated successfully');
      } catch (err: any) {
        console.error('❌ Invitation validation error:', err);
        setError('Failed to validate invitation: ' + err.message);
        setLoading(false);
      }
    };

    validateInvitation();
  }, [token]);

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitation) return;

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
      console.log('🔐 Completing invitation setup...');

      // Call Edge Function to complete invitation and set password
      const { data: { session } } = await supabase.auth.getSession();
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
        console.error('❌ Invitation completion failed:', result.error);
        throw new Error(result.error || 'Failed to complete invitation');
      }

      console.log('✅ Invitation completed successfully');

      // Sign in the user with new password
      console.log('🔑 Signing in user...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: password
      });

      if (signInError) {
        console.error('❌ Sign in failed:', signInError);
        throw signInError;
      }

      console.log('✅ User signed in successfully');

      toast({
        title: "Success!",
        description: "Your account has been set up. Redirecting...",
      });

      // Redirect to root - Auth page will handle role-based routing
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (err: any) {
      console.error('❌ Password setup error:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to set up your account. Please try again or contact support.",
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
              <p className="text-muted-foreground">Validating your invitation...</p>
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
            <p className="text-muted-foreground">Agricultural Finance Management</p>
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
                {isExpired ? 'Invitation Expired' : isAlreadyUsed ? 'Already Used' : 'Invalid Invitation'}
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
                    onClick={() => navigate('/auth')}
                    variant="outline"
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                  <p className="text-xs text-muted-foreground pt-2">
                    Need a new invitation? Contact your administrator.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main password setup form
  const expiresAt = invitation ? new Date(invitation.expires_at) : null;
  const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">TelAgri</CardTitle>
          <p className="text-muted-foreground">Set Up Your Password</p>
        </CardHeader>
        <CardContent>
          {/* Invitation Details */}
          <div className="mb-6 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{invitation?.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium capitalize">
                {invitation?.role === 'bank_viewer' ? 'Bank Viewer' : invitation?.role}
              </span>
            </div>
            {bankName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bank:</span>
                <span className="font-medium">{bankName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Expires in:</span>
              <span className={`font-medium ${daysRemaining <= 1 ? 'text-destructive' : 'text-primary'}`}>
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>You can revisit this link anytime before it expires</span>
            </div>
          </div>

          {/* Password Setup Form */}
          <form onSubmit={handlePasswordSetup} className="space-y-4">
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
                  Setting up your account...
                </>
              ) : (
                "Set Password & Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              By setting up your account, you agree to TelAgri's terms of service and privacy policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationAccept;
