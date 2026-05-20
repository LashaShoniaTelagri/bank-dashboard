import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { 
  Search, 
  Users, 
  Eye, 
  Loader2, 
  AlertCircle,
  UserCircle,
  Mail,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/hooks/useImpersonation';
import { toast } from './ui/use-toast';
import { ScrollArea } from './ui/scroll-area';

interface UserImpersonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserProfile {
  user_id: string;
  email: string;
  role: string;
  bank_id: string | null;
  bank_name: string | null;
  created_at: string;
}

export const UserImpersonationModal: React.FC<UserImpersonationModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { startImpersonation, isLoading: impersonating } = useImpersonation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users when modal opens
  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.email.toLowerCase().includes(query) ||
            user.role.toLowerCase().includes(query) ||
            user.bank_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);

    try {
      // Use RPC function to get users with their emails from auth.users
      const { data, error: queryError } = await supabase
        .rpc('get_users_for_impersonation');

      if (queryError) throw queryError;

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err.message || 'Failed to load users');
      toast({
        title: 'Error Loading Users',
        description: 'Failed to load user list. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleImpersonate = async () => {
    if (!selectedUser) return;

    try {
      await startImpersonation(selectedUser.user_id, reason.trim() || undefined);
      
      toast({
        title: 'Account Switched',
        description: `Now viewing as ${selectedUser.email}`,
      });

      // Modal will close and page will reload
      onOpenChange(false);
    } catch (err: any) {
      console.error('Account switch failed:', err);
      toast({
        title: 'Account Switch Failed',
        description: err.message || 'Failed to switch account',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'specialist':
      case 'field_specialist':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'bank_viewer':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" aria-describedby="impersonation-modal-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Eye className="h-5 w-5 text-primary" />
            Switch Account
          </DialogTitle>
          <DialogDescription id="impersonation-modal-desc" className="text-sm text-muted-foreground">
            View the system as another user would see it. All actions are logged for security compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium">
              Search Users
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by email, role, or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* User List */}
          <div className="flex-1 min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Select User ({filteredUsers.length} available)
              </Label>
              {isLoadingUsers && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredUsers.length === 0 && !isLoadingUsers && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {searchQuery ? 'No users found matching your search' : 'No users available'}
                    </p>
                  </div>
                )}

                {filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                      selectedUser?.user_id === user.user_id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <UserCircle className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {user.email}
                          </span>
                          <Badge className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </Badge>
                        </div>
                        
                        {user.bank_name && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Shield className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{user.bank_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Reason (optional) */}
          {selectedUser && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Reason for Account Switch <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="e.g., Support ticket #123, Testing permissions, Helping with issue..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This will be logged for audit compliance. Be specific about why you're accessing this user's account.
              </p>
            </div>
          )}

          {/* Security Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1">Security Notice</p>
              <p>All actions during this session will be logged and attributed to your admin account. Use this feature responsibly for support and testing purposes only.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={impersonating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={!selectedUser || impersonating}
            className="bg-primary hover:bg-primary/90"
          >
            {impersonating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Switching Account...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Switch Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserImpersonationModal;

