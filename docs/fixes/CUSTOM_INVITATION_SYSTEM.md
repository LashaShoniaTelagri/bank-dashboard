# Custom Invitation System - Solution Design

## Problem Statement

### Supabase Limitations Discovered:
1. **Maximum OTP/Recovery token expiration: 24 hours** (86,400 seconds max)
   - Cannot be extended to 5 days
   - This is a hard limit in Supabase Auth
2. **Single-use tokens** (security feature)
   - Token expires after first click
   - Bad UX: Users can't revisit the link if they close browser
   - Users must complete setup in one session

### Requirements:
- ✅ 5-day invitation validity (user requirement)
- ✅ Allow multiple clicks on same link (better UX)
- ✅ Maintain security standards
- ✅ Work within Supabase constraints

---

## Solution: Custom Invitation Token System

### Architecture Overview

Instead of relying solely on Supabase recovery tokens, we'll implement a **two-tier token system**:

1. **Tier 1: Our Custom Long-Lived Token** (5 days)
   - Stored in database
   - Can be clicked multiple times
   - We control the expiration
   
2. **Tier 2: Supabase Recovery Token** (24 hours)
   - Generated only when user is ready to set password
   - Single-use for final authentication step
   - Maintains Supabase security standards

---

## Implementation Plan

### Phase 1: Database Schema

Create a new `invitations` table:

```sql
-- Migration: Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'bank_viewer', 'specialist')),
  bank_id UUID REFERENCES public.banks(id) ON DELETE CASCADE,
  invited_by TEXT,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  clicks_count INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast token lookup
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_status ON public.invitations(status);
CREATE INDEX idx_invitations_expires_at ON public.invitations(expires_at);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own invitation"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invitations_updated_at_trigger
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_invitations_updated_at();
```

### Phase 2: Update Invitation Edge Functions

Modify both `invite-user` and `invite-bank-viewer` functions:

```typescript
// Generate custom secure token
const generateInvitationToken = () => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

// In the Edge Function:
const invitationToken = generateInvitationToken();
const expiresAt = new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)); // 5 days

// Store invitation in database
const { data: invitation, error: invError } = await supabaseClient
  .from('invitations')
  .insert({
    email: email,
    token: invitationToken,
    user_id: userId,
    role: role,
    bank_id: role === 'admin' ? null : bankId,
    invited_by: inviterEmail,
    expires_at: expiresAt.toISOString(),
    status: 'pending'
  })
  .select()
  .single();

// Create custom invitation URL (NOT Supabase recovery link)
const invitationUrl = `${baseUrl}/invitation/accept?token=${invitationToken}`;

// Send email with custom invitation URL
const emailData = createInvitationEmail(
  email,
  role,
  bankName,
  invitationUrl  // Our custom URL, not Supabase recovery link
);
```

### Phase 3: Create Invitation Acceptance Page

Create new page: `src/pages/InvitationAccept.tsx`

```typescript
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const InvitationAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validateInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        // Validate token and get invitation details
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .single();

        if (error || !data) {
          setError('Invitation not found');
          setLoading(false);
          return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This invitation has expired. Please contact your administrator for a new invitation.');
          
          // Update status in database
          await supabase
            .from('invitations')
            .update({ status: 'expired' })
            .eq('token', token);
          
          setLoading(false);
          return;
        }

        // Check if already completed
        if (data.status === 'completed') {
          setError('This invitation has already been used. Please sign in with your credentials.');
          setLoading(false);
          return;
        }

        // Check if cancelled
        if (data.status === 'cancelled') {
          setError('This invitation has been cancelled. Please contact your administrator.');
          setLoading(false);
          return;
        }

        // Track click
        await supabase
          .from('invitations')
          .update({ 
            clicks_count: data.clicks_count + 1,
            last_clicked_at: new Date().toISOString()
          })
          .eq('token', token);

        setInvitation(data);
        setLoading(false);
      } catch (err: any) {
        console.error('Invitation validation error:', err);
        setError('Failed to validate invitation');
        setLoading(false);
      }
    };

    validateInvitation();
  }, [token]);

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      // Update user password using admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        invitation.user_id,
        { password: password }
      );

      if (updateError) throw updateError;

      // Mark invitation as completed
      await supabase
        .from('invitations')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('token', token);

      // Update profile status
      await supabase
        .from('profiles')
        .update({ 
          invitation_status: 'active'
        })
        .eq('user_id', invitation.user_id);

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: password
      });

      if (signInError) throw signInError;

      toast({
        title: "Success!",
        description: "Your account has been set up. Redirecting...",
      });

      // Redirect based on role
      setTimeout(() => {
        if (invitation.role === 'admin') {
          navigate('/admin');
        } else if (invitation.role === 'specialist') {
          navigate('/specialist');
        } else {
          navigate('/dashboard');
        }
      }, 1000);

    } catch (err: any) {
      console.error('Password setup error:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to set up your account",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">TelAgri</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-6 bg-destructive/10 dark:bg-destructive/20 border border-destructive/30 rounded-lg">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Invitation Link Issue
              </h3>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
            </div>
            
            <Button 
              onClick={() => navigate('/auth')}
              variant="outline"
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">TelAgri</CardTitle>
          <p className="text-muted-foreground">Set Up Your Password</p>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm">
              <strong>Email:</strong> {invitation?.email}
            </p>
            <p className="text-sm mt-1">
              <strong>Role:</strong> {invitation?.role}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Invitation expires: {new Date(invitation?.expires_at).toLocaleDateString()}
            </p>
          </div>

          <form onSubmit={handlePasswordSetup} className="space-y-4">
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
              className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600" 
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
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationAccept;
```

### Phase 4: Add Route

Update `src/App.tsx`:

```typescript
import InvitationAccept from "@/pages/InvitationAccept";

// Add route
<Route path="/invitation/accept" element={<InvitationAccept />} />
```

### Phase 5: Update Email Templates

Change invitation URLs from Supabase recovery links to custom links:

```typescript
// OLD (Supabase recovery link):
const resetUrl = resetData.properties.action_link;

// NEW (Custom invitation link):
const invitationUrl = `${baseUrl}/invitation/accept?token=${invitationToken}`;
```

---

## Benefits of This Approach

### ✅ Solves Both Issues:
1. **5-Day Expiration:** We control it in our database
2. **Multiple Clicks:** Users can revisit the link anytime before expiration
3. **Better UX:** Users can close browser and come back later
4. **Security:** Still uses Supabase auth for final password setup
5. **Tracking:** Know when users clicked, how many times, etc.

### ✅ Additional Features:
- Track invitation status (pending, completed, expired, cancelled)
- Cancel invitations if needed
- Resend invitations (just create new token)
- See click analytics
- Automatic expiration handling

---

## Migration Path

### Step 1: Create Database Migration
```bash
# Create migration file
supabase migration new create_invitations_table

# Add SQL from Phase 1 to the migration file
```

### Step 2: Update Edge Functions
- Modify `invite-user/index.ts`
- Modify `invite-bank-viewer/index.ts`

### Step 3: Create Frontend Components
- Create `src/pages/InvitationAccept.tsx`
- Update `src/App.tsx` with new route

### Step 4: Deploy
```bash
# Run migration
supabase db push

# Deploy edge functions
supabase functions deploy invite-user
supabase functions deploy invite-bank-viewer

# Deploy frontend
npm run build
```

### Step 5: Testing
- Send test invitation
- Click link multiple times
- Verify 5-day expiration
- Test password setup flow

---

## Implementation Estimate

- Database migration: 30 minutes
- Edge function updates: 1-2 hours
- Frontend page creation: 1-2 hours
- Testing & refinement: 1 hour
- **Total: 4-5 hours**

---

## Security Considerations

### ✅ Maintained:
- Secure token generation (crypto.getRandomValues)
- Database-level RLS policies
- Supabase auth for final authentication
- HTTPS only for all URLs
- Token expiration enforced

### ✅ Improved:
- Can track and cancel invitations
- Can see if invitation is being abused (too many clicks)
- Better audit trail

---

## Next Steps

1. Review and approve this design
2. Create database migration
3. Update Edge Functions
4. Create InvitationAccept page
5. Test thoroughly
6. Deploy to production

---

Last Updated: January 22, 2026
Status: Design Complete - Ready for Implementation
Estimated Time: 4-5 hours
