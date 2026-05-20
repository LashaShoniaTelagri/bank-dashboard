import React, { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Plus, X, ExternalLink, MapPin, Loader2 } from "lucide-react";
import { toast } from "./ui/use-toast";

interface PhaseIframeManagerProps {
  farmerId: string;
  phaseNumber: number;
  isAdmin: boolean;
}

interface IframeItem {
  url: string;
  name: string;
  annotation?: string;
}

export const PhaseIframeManager: React.FC<PhaseIframeManagerProps> = ({
  farmerId,
  phaseNumber,
  isAdmin
}) => {
  const queryClient = useQueryClient();
  const [iframeUrlInput, setIframeUrlInput] = useState('');
  const [iframeNameInput, setIframeNameInput] = useState('');
  const [iframeAnnotationInput, setIframeAnnotationInput] = useState('');

  // Fetch phase data with iframe URLs
  const { data: phaseData, isLoading } = useQuery({
    queryKey: ['farmer-phase', farmerId, phaseNumber],
    queryFn: async () => {
      console.log('🔍 Fetching phase data:', { farmerId, phaseNumber });
      const { data, error } = await supabase
        .from('farmer_phases')
        .select('id, iframe_urls')
        .eq('farmer_id', farmerId)
        .eq('phase_number', phaseNumber)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching phase data:', error);
        throw error;
      }
      console.log('✅ Phase data fetched:', { id: data?.id, iframeUrlsCount: (data?.iframe_urls as IframeItem[])?.length || 0 });
      return data;
    },
    enabled: !!farmerId && !!phaseNumber,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0 // Don't cache stale data
  });

  const iframeUrls: IframeItem[] = (phaseData?.iframe_urls as IframeItem[]) || [];

  // Auto-save mutation
  const saveMutation = useMutation({
    mutationFn: async (urls: IframeItem[]) => {
      const formattedUrls = urls.map(item => ({
        url: item.url,
        name: item.name,
        annotation: item.annotation || null
      }));

      console.log('💾 Saving iframe URLs:', {
        farmerId,
        phaseNumber,
        urlsCount: formattedUrls.length,
        phaseDataId: phaseData?.id
      });

      // Try to update first, if no rows affected, insert
      if (phaseData?.id) {
        const { data, error } = await supabase
          .from('farmer_phases')
          .update({ iframe_urls: formattedUrls })
          .eq('id', phaseData.id)
          .select()
          .single();

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        console.log('✅ Updated phase:', data);
        return data;
      } else {
        // Create new phase record
        const { data, error } = await supabase
          .from('farmer_phases')
          .insert({
            farmer_id: farmerId,
            phase_number: phaseNumber,
            iframe_urls: formattedUrls
          })
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          // If it's a unique constraint violation, try update instead
          if (error.code === '23505') {
            const { data: updateData, error: updateError } = await supabase
              .from('farmer_phases')
              .update({ iframe_urls: formattedUrls })
              .eq('farmer_id', farmerId)
              .eq('phase_number', phaseNumber)
              .select()
              .single();

            if (updateError) {
              console.error('Update after insert conflict error:', updateError);
              throw updateError;
            }
            console.log('✅ Updated phase after conflict:', updateData);
            return updateData;
          }
          throw error;
        }
        console.log('✅ Created new phase:', data);
        return data;
      }
    },
    onSuccess: (data) => {
      console.log('✅ Successfully saved iframe URLs');
      queryClient.setQueryData(['farmer-phase', farmerId, phaseNumber], data);
      queryClient.invalidateQueries({ queryKey: ['farmer-phase', farmerId, phaseNumber] });
      toast({
        title: "Saved",
        description: "Iframe URLs saved successfully",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Failed to save iframe URLs:', error);
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleAdd = useCallback(() => {
    const trimmedUrl = iframeUrlInput.trim();
    const trimmedName = iframeNameInput.trim();

    if (!trimmedUrl) {
      toast({
        title: "URL required",
        description: "Please enter a URL",
        variant: "destructive"
      });
      return;
    }

    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Please enter a name for this iframe",
        variant: "destructive"
      });
      return;
    }

    const normalizedUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    if (!isValidUrl(normalizedUrl)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    if (iframeUrls.some(item => item.url === normalizedUrl)) {
      toast({
        title: "Duplicate URL",
        description: "This URL already exists",
        variant: "destructive"
      });
      return;
    }

    const newUrls = [...iframeUrls, {
      url: normalizedUrl,
      name: trimmedName,
      annotation: iframeAnnotationInput.trim() || undefined
    }];

    setIframeUrlInput('');
    setIframeNameInput('');
    setIframeAnnotationInput('');
    saveMutation.mutate(newUrls);
  }, [iframeUrlInput, iframeNameInput, iframeAnnotationInput, iframeUrls, saveMutation]);

  const handleRemove = useCallback((urlToRemove: string) => {
    const newUrls = iframeUrls.filter(item => item.url !== urlToRemove);
    saveMutation.mutate(newUrls);
  }, [iframeUrls, saveMutation]);

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  if (!isAdmin && iframeUrls.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Phase {phaseNumber} - Interactive Maps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="URL (required)"
                value={iframeUrlInput}
                onChange={(e) => setIframeUrlInput(e.target.value)}
                type="url"
                className="md:col-span-3"
              />
              <Input
                placeholder="Name (required)"
                value={iframeNameInput}
                onChange={(e) => setIframeNameInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <Input
                placeholder="Annotation (optional)"
                value={iframeAnnotationInput}
                onChange={(e) => setIframeAnnotationInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                className="md:col-span-2"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={saveMutation.isPending}
              className="w-full md:w-auto"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Iframe
                </>
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : iframeUrls.length === 0 ? (
          <div className="text-sm text-muted-foreground">No iframes added yet</div>
        ) : (
          <div className="space-y-2">
            {iframeUrls.map((item, index) => (
              <div key={index} className="p-3 border rounded-lg bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground mb-1">{item.name}</div>
                    {item.annotation && (
                      <div className="text-xs text-muted-foreground mb-2">{item.annotation}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                        title={item.url}
                      >
                        {truncateUrl(item.url, 60)}
                      </a>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(item.url)}
                      disabled={saveMutation.isPending}
                      className="h-7 w-7 p-0 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

