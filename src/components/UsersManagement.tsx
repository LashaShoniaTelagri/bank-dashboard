import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { UserX, Trash2, RefreshCw, AlertTriangle, Shield, Clock, Brain } from "lucide-react";
import { toast } from "./ui/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";

interface Invitation {
  user_id: string;
  email: string;
  role: string;
  bank_id?: string;
  bank_name?: string;
  invited_by?: string;
  invited_at: string;
  invitation_accepted_at?: string;
  invitation_status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: string;
}

interface Bank {
  id: string;
  name: string;
}

export const UsersManagement = () => {
  const { user } = useAuth();
  const [isInviting, setIsInviting] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    role: "",
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
    mutationFn: async (data: { email: string; role: string; bankId?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: data.email,
          role: data.role,
          bankId: data.role === 'bank_viewer' ? data.bankId : undefined,
          inviterEmail: user?.email,
        }
      });

      if (error) {
        // Handle specific error cases
        if (error.message?.includes('already has a')) {
          throw new Error(`User ${data.email} is already invited to this ${data.role === 'admin' ? 'admin role' : 'bank'}.`);
        }
        throw error;
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: "Invitation sent!",
        description: `${inviteData.role === 'admin' ? 'Administrator' : inviteData.role === 'specialist' ? 'Specialist' : 'Bank viewer'} invitation has been sent to ${inviteData.email}`,
      });
      
      setIsInviting(false);
      setInviteData({ email: "", role: "", bankId: "" });
    },
    onError: (error) => {
      console.error('Invitation error:', error);
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ invitation_status: 'cancelled' })
        .eq('user_id', userId);
      
      if (error) throw error;
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
          throw new Error(`Failed to delete user: ${profileError.message}`);
        }
        
        // If profile deleted but auth user remains, warn about partial deletion
        throw new Error('Profile deleted but user may still exist in auth system. Contact admin if issues persist.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: "User deleted",
        description: "The user has been permanently deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncStatusesMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('sync_invitation_statuses');
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
    if (!inviteData.email || !inviteData.role) {
      toast({
        title: "Missing information",
        description: "Please provide email and role",
        variant: "destructive",
      });
      return;
    }

    if (inviteData.role === 'bank_viewer' && !inviteData.bankId) {
      toast({
        title: "Missing bank selection",
        description: "Please select a bank for bank viewer invitations",
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate(inviteData);
  };

  const handleCancelInvitation = (userId: string, email: string) => {
    if (confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
      cancelInvitationMutation.mutate(userId);
    }
  };

  const handleDeleteUser = (userId: string, email: string) => {
    if (confirm(`Are you sure you want to permanently delete ${email}? This action cannot be undone.`)) {
      deleteInvitationMutation.mutate(userId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite Users Section */}
      <Card>
        <CardHeader>
          <CardTitle>Invite New User</CardTitle>
          <CardDescription>
            Send invitations to new administrators or bank viewers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">User Role</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(value) => setInviteData(prev => ({ ...prev, role: value, bankId: value === 'admin' ? "" : prev.bankId }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Administrator
                      </div>
                    </SelectItem>
                    <SelectItem value="bank_viewer">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Bank Viewer</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="specialist">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        Specialist
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(inviteData.role === 'bank_viewer') && (
              <div className="space-y-2">
                <Label htmlFor="bank">Bank</Label>
                <Select
                  value={inviteData.bankId}
                  onValueChange={(value) => setInviteData(prev => ({ ...prev, bankId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
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
            )}

            <Button 
              type="submit" 
              disabled={inviteMutation.isPending}
              className="w-full md:w-auto"
            >
              {inviteMutation.isPending ? "Sending..." : `Invite ${inviteData.role === 'admin' ? 'Administrator' : inviteData.role === 'specialist' ? 'Specialist' : 'Bank Viewer'}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Recent Invitations Section */}
      <RecentInvitations 
        cancelInvitationMutation={cancelInvitationMutation}
        deleteInvitationMutation={deleteInvitationMutation}
        syncStatusesMutation={syncStatusesMutation}
        onCancelInvitation={handleCancelInvitation}
        onDeleteUser={handleDeleteUser}
      />
    </div>
  );
};

interface RecentInvitationsProps {
  cancelInvitationMutation: {
    isPending: boolean;
    mutate: (userId: string) => void;
  };
  deleteInvitationMutation: {
    isPending: boolean;
    mutate: (userId: string) => void;
  };
  syncStatusesMutation: {
    isPending: boolean;
    mutate: () => void;
  };
  onCancelInvitation: (userId: string, email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
}

const RecentInvitations = ({ 
  cancelInvitationMutation, 
  deleteInvitationMutation, 
  syncStatusesMutation,
  onCancelInvitation,
  onDeleteUser
}: RecentInvitationsProps) => {
  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invitation_details');
      if (error) {
        console.error('Failed to fetch invitations:', error);
        throw error;
      }
      return data as Invitation[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <Badge variant="outline" className="text-yellow-600 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>,
      accepted: <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">✅ Active</Badge>,
      expired: <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>,
      cancelled: <Badge variant="outline" className="text-muted-foreground border-border">❌ Cancelled</Badge>
    };
    return badges[status as keyof typeof badges] || <Badge variant="outline">{status}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return <Badge variant="default" className="bg-purple-100 text-purple-800 border-purple-300"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    }
    if (role === 'specialist') {
      return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-300"><Brain className="w-3 h-3 mr-1" />Specialist</Badge>;
    }
    return <Badge variant="outline">Bank Viewer</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent User Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading invitations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent User Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">Failed to load invitations</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent User Invitations</CardTitle>
          <CardDescription>
            Manage pending, active, and expired user invitations
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncStatusesMutation.mutate()}
          disabled={syncStatusesMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncStatusesMutation.isPending ? 'animate-spin' : ''}`} />
          Sync Status
        </Button>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No invitations found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div 
                key={invitation.user_id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium">{invitation.email}</span>
                    {getRoleBadge(invitation.role)}
                    {invitation.role === 'bank_viewer' && invitation.bank_name && (
                      <Badge variant="outline" className="text-xs">{invitation.bank_name}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Invited by {invitation.invited_by} on {new Date(invitation.invited_at).toLocaleDateString()}
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
                    {/* Cancel button for pending invitations */}
                    {invitation.invitation_status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelInvitation(invitation.user_id, invitation.email)}
                        disabled={cancelInvitationMutation.isPending}
                        title="Cancel invitation"
                        className="text-amber-600 hover:text-amber-800 hover:bg-amber-100"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {/* Delete button - now available for all users including accepted ones */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteUser(invitation.user_id, invitation.email)}
                      disabled={deleteInvitationMutation.isPending}
                      title="Delete user permanently"
                      className="text-red-600 hover:text-red-800 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};