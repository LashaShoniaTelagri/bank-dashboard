import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Mail, CheckCircle, Clock, AlertCircle, Trash2, UserX, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Bank {
  id: string;
  name: string;
}

interface Invitation {
  user_id: string;
  email: string;
  role: string;
  bank_id: string;
  bank_name: string;
  invited_by: string;
  invited_at: string;
  invitation_accepted_at?: string;
  invitation_status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  created_at: string;
}

export const UsersManagement = () => {
  const { user } = useAuth();
  const [isInviting, setIsInviting] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    bankId: "",
  });
  
  const queryClient = useQueryClient();

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Bank[];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; bankId: string }) => {
      const { data: result, error } = await supabase.functions.invoke('invite-bank-viewer', {
        body: {
          email: data.email,
          bankId: data.bankId,
          inviterEmail: user?.email,
        }
      });

      if (error) {
        // Handle specific error cases
        if (error.message?.includes('already a bank viewer')) {
          throw new Error(`User ${data.email} is already invited to this bank.`);
        }
        throw error;
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: "Invitation sent!",
        description: `Bank viewer invitation has been sent to ${inviteData.email}`,
      });
      
      setIsInviting(false);
      setInviteData({ email: "", bankId: "" });
    },
    onError: (error) => {
      console.error('Invitation error:', error);
      let errorMessage = error.message || "Failed to send invitation. Please check your configuration.";
      
      // Provide specific guidance for common errors
      if (errorMessage.includes('already invited')) {
        errorMessage = `${inviteData.email} is already invited to this bank. Check the Recent Invitations section below.`;
      } else if (errorMessage.includes('API key')) {
        errorMessage = "SendGrid API key not configured properly. Please check your settings.";
      } else if (errorMessage.includes('non-2xx status')) {
        errorMessage = "Email service configuration issue. Please check SendGrid settings and try again.";
      }
      
      toast({
        title: "Error sending invite",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          invitation_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('invitation_status', 'pending')
        .select();

      if (error) throw error;
      
      // Check if any rows were actually updated
      if (!data || data.length === 0) {
        throw new Error('Invitation not found or already processed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error cancelling invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Use Edge Function to properly delete both profile and auth user
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) {
        console.error('Delete function error:', error);
        // Fallback: try to delete just the profile if Edge Function fails
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('user_id', userId);
        
        if (profileError) {
          throw new Error(`Failed to delete invitation: ${profileError.message}`);
        }
        
        // If profile deleted but auth user remains, warn about partial deletion
        throw new Error('Profile deleted but user may still exist in auth system. Contact admin if issues persist.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: "Invitation deleted",
        description: "The invitation has been permanently deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncStatusesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('sync_invitation_statuses' as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: "Status sync completed",
        description: "All invitation statuses have been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error syncing statuses",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteData.email || !inviteData.bankId) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate(inviteData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Users Management</h2>
        <Button 
          onClick={() => setIsInviting(true)} 
          disabled={isInviting}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Invite Bank Viewer
        </Button>
      </div>

      {isInviting && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Bank Viewer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Email *</label>
                <Input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Bank *</label>
                <Select 
                  value={inviteData.bankId} 
                  onValueChange={(value) => setInviteData({ ...inviteData, bankId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={inviteMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
                >
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Invite"
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsInviting(false);
                    setInviteData({ email: "", bankId: "" });
                  }}
                  className="border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transform transition-all duration-200 hover:scale-[1.02] shadow-md"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Invitations</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => syncStatusesMutation.mutate()}
              disabled={syncStatusesMutation.isPending}
              className="group border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg active:scale-95 transform transition-all duration-300 hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {syncStatusesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                  Refresh Status
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RecentInvitations 
            cancelInvitationMutation={cancelInvitationMutation}
            deleteInvitationMutation={deleteInvitationMutation}
          />
        </CardContent>
      </Card>
    </div>
  );
};

interface RecentInvitationsProps {
  cancelInvitationMutation: any;
  deleteInvitationMutation: any;
}

const RecentInvitations = ({ cancelInvitationMutation, deleteInvitationMutation }: RecentInvitationsProps) => {
  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      // Use the new database function to get complete invitation data
      const { data, error } = await supabase.rpc('get_invitation_details');
      
      if (error) {
        console.error('Error fetching invitations:', error);
        throw error;
      }
      
      return (data || []) as Invitation[];
    },
    retry: 1,
  });

  const handleCancelInvitation = (userId: string, email: string) => {
    if (window.confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
      cancelInvitationMutation.mutate(userId);
    }
  };

  const handleDeleteInvitation = (userId: string, email: string) => {
    if (window.confirm(`Are you sure you want to permanently delete the invitation for ${email}? This action cannot be undone.`)) {
      deleteInvitationMutation.mutate(userId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <UserX className="h-4 w-4 text-gray-500" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      accepted: 'default',
      pending: 'secondary',
      cancelled: 'outline',
      expired: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading invitations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
        <p className="text-sm text-muted-foreground mb-2">
          Unable to load invitations. This might be because the database migration hasn't been applied yet.
        </p>
        <p className="text-xs text-muted-foreground">
          Please run the SQL migration in Supabase SQL Editor first.
        </p>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="mb-2">No invitations sent yet.</p>
        <p className="text-sm">Bank viewer invitations will appear here after you send them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invitations.map((invitation) => (
        <div 
          key={invitation.user_id} 
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            {getStatusIcon(invitation.invitation_status)}
            <div>
              <p className="font-medium">{invitation.email}</p>
              <p className="text-sm text-muted-foreground">
                {invitation.bank_name} • Invited by {invitation.invited_by}
              </p>
              <p className="text-xs text-muted-foreground">
                Sent {new Date(invitation.invited_at).toLocaleDateString()} at {new Date(invitation.invited_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(invitation.invitation_status)}
              {invitation.invitation_status === 'accepted' && invitation.invitation_accepted_at && (
                <p className="text-xs text-muted-foreground">
                  Accepted {new Date(invitation.invitation_accepted_at).toLocaleDateString()}
                </p>
              )}
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-1">
              {/* Cancel button for pending invitations or "accepted" users who haven't actually signed in */}
              {(invitation.invitation_status === 'pending' || 
                (invitation.invitation_status === 'accepted' && !invitation.invitation_accepted_at)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelInvitation(invitation.user_id, invitation.email)}
                  disabled={cancelInvitationMutation.isPending}
                  title="Cancel invitation"
                  className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 active:scale-95 transform transition-all duration-300 hover:scale-110 shadow-sm hover:shadow-md"
                >
                  <UserX className="h-4 w-4" />
                </Button>
              )}
              
              {/* Delete button available for non-active invitations */}
              {['pending', 'cancelled', 'expired'].includes(invitation.invitation_status) || 
               (invitation.invitation_status === 'accepted' && !invitation.invitation_accepted_at) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteInvitation(invitation.user_id, invitation.email)}
                  disabled={deleteInvitationMutation.isPending}
                  title="Delete invitation permanently"
                  className="text-red-600 hover:text-red-800 hover:bg-red-100 active:scale-95 transform transition-all duration-300 hover:scale-110 shadow-sm hover:shadow-md"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {invitations.length >= 10 && (
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing 10 most recent invitations
          </p>
        </div>
      )}
    </div>
  );
};