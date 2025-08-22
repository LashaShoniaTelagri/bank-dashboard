import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Smartphone, Trash2, Shield, Clock, MapPin, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { generateDeviceFingerprint, getDeviceDescription } from '@/lib/deviceFingerprint';

interface TrustedDevice {
  id: string;
  device_fingerprint: string;
  device_info: {
    userAgent?: string;
    platform?: string;
    browserFingerprint?: string;
    screenResolution?: string;
    timezone?: string;
  };
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

export const TrustedDevicesManager = () => {
  const [currentDeviceFingerprint, setCurrentDeviceFingerprint] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; deviceId?: string; deviceDescription?: string }>({ open: false });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current device fingerprint
  useEffect(() => {
    const getCurrentFingerprint = async () => {
      try {
        const fingerprint = await generateDeviceFingerprint();
        setCurrentDeviceFingerprint(fingerprint);
      } catch (error) {
        console.error('Failed to get device fingerprint:', error);
      }
    };
    getCurrentFingerprint();
  }, []);

  // Fetch trusted devices
  const { data: trustedDevices = [], isLoading, refetch } = useQuery({
    queryKey: ['trusted-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .order('last_used_at', { ascending: false });
      
      if (error) throw error;
      return data as TrustedDevice[];
    },
  });

  // Remove trusted device mutation
  const removeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trusted-devices'] });
      toast({
        title: "Device removed",
        description: "The trusted device has been removed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove device: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleRemoveDevice = (deviceId: string, deviceInfo: any) => {
    const description = getDeviceDescriptionFromInfo(deviceInfo);
    setConfirmDialog({
      open: true,
      deviceId,
      deviceDescription: description
    });
  };

  const confirmRemoveDevice = () => {
    if (confirmDialog.deviceId) {
      removeDeviceMutation.mutate(confirmDialog.deviceId);
      setConfirmDialog({ open: false });
    }
  };

  const getDeviceDescriptionFromInfo = (deviceInfo: any): string => {
    if (!deviceInfo) return 'Unknown Device';
    
    const { userAgent = '', platform = '' } = deviceInfo;
    
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    
    // Detect browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    
    // Detect OS
    if (userAgent.includes('Windows') || platform.includes('Win')) os = 'Windows';
    else if (userAgent.includes('Mac') || platform.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';
    
    return `${browser} on ${os}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilExpiry = (expiresAt: string): number => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffInMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Trusted Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Trusted Devices
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Devices that can skip 2FA verification for 30 days
          </p>
        </CardHeader>
        <CardContent>
          {trustedDevices.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No trusted devices</h3>
              <p className="text-sm text-gray-500">
                When you check "Remember this device" during 2FA, it will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {trustedDevices.map((device) => {
                const isCurrentDevice = device.device_fingerprint === currentDeviceFingerprint;
                const daysLeft = getDaysUntilExpiry(device.expires_at);
                const deviceDescription = getDeviceDescriptionFromInfo(device.device_info);
                
                return (
                  <div
                    key={device.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isCurrentDevice 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-gray-200 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Smartphone className={`h-5 w-5 ${
                          isCurrentDevice ? 'text-emerald-600' : 'text-gray-500'
                        }`} />
                        {isCurrentDevice && (
                          <div className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">
                            {deviceDescription}
                          </h4>
                          {isCurrentDevice && (
                            <Badge variant="secondary" className="text-xs">
                              This device
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                          </span>
                          <span>Added {formatDate(device.created_at)}</span>
                          {device.last_used_at && (
                            <span>Last used {formatDate(device.last_used_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDevice(device.id, device.device_info)}
                      disabled={removeDeviceMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false })}
        onConfirm={confirmRemoveDevice}
        title="Remove Trusted Device"
        description={`Are you sure you want to remove "${confirmDialog.deviceDescription}"? This device will need to complete 2FA verification on the next login.`}
      />
    </>
  );
}; 