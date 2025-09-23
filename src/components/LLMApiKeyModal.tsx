import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { 
  Key, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Settings
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "./ui/use-toast";
import { LLMApiKeyForm, LLMProvider, LLMApiKey } from "../types/specialist";
import { llmService } from "../lib/llm-service";
import { LLM_PROVIDERS } from "../types/specialist";

export const LLMApiKeyModal: React.FC = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [newKeyData, setNewKeyData] = useState<LLMApiKeyForm>({
    provider: 'openai',
    key_name: '',
    api_key: ''
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);

  const queryClient = useQueryClient();

  // Fetch existing API keys
  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['llm-api-keys'],
    queryFn: async () => {
      return await llmService.listApiKeys();
    },
    enabled: !!profile?.user_id,
  });

  // Add API key mutation
  const addKeyMutation = useMutation({
    mutationFn: async (keyData: LLMApiKeyForm) => {
      // Validate API key first
      setValidatingKey(true);
      try {
        const isValid = await llmService.validateApiKey(keyData.provider, keyData.api_key);
        if (!isValid) {
          throw new Error('Invalid API key. Please check your credentials.');
        }
      } finally {
        setValidatingKey(false);
      }

      // Store the API key
      await llmService.storeApiKey(keyData.provider, keyData.key_name, keyData.api_key);
    },
    onSuccess: () => {
      toast({
        title: "API key added successfully",
        description: "Your API key has been validated and stored securely",
      });
      
      // Reset form
      setNewKeyData({
        provider: 'openai',
        key_name: '',
        api_key: ''
      });
      setIsAddingKey(false);
      
      // Refresh keys list
      queryClient.invalidateQueries({ queryKey: ['llm-api-keys'] });
    },
    onError: (error) => {
      console.error('Add API key error:', error);
      toast({
        title: "Failed to add API key",
        description: error.message,
        variant: "destructive",
      });
      setValidatingKey(false);
    }
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await llmService.deleteApiKey(keyId);
    },
    onSuccess: () => {
      toast({
        title: "API key deleted",
        description: "API key has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['llm-api-keys'] });
    },
    onError: (error) => {
      console.error('Delete API key error:', error);
      toast({
        title: "Failed to delete API key",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyData.key_name.trim()) {
      toast({
        title: "Key name required",
        description: "Please enter a name for your API key",
        variant: "destructive",
      });
      return;
    }

    if (!newKeyData.api_key.trim()) {
      toast({
        title: "API key required",
        description: "Please enter your API key",
        variant: "destructive",
      });
      return;
    }

    addKeyMutation.mutate(newKeyData);
  };

  // Get provider icon
  const getProviderIcon = (provider: LLMProvider) => {
    switch (provider) {
      case 'openai':
        return <Key className="h-4 w-4 text-green-600" />;
      case 'anthropic':
        return <Key className="h-4 w-4 text-orange-600" />;
      case 'google':
        return <Key className="h-4 w-4 text-blue-600" />;
      case 'azure':
        return <Key className="h-4 w-4 text-blue-500" />;
      default:
        return <Key className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get provider color
  const getProviderColor = (provider: LLMProvider) => {
    switch (provider) {
      case 'openai':
        return 'bg-green-100 text-green-800';
      case 'anthropic':
        return 'bg-orange-100 text-orange-800';
      case 'google':
        return 'bg-blue-100 text-blue-800';
      case 'azure':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          API Keys
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>LLM API Key Management</DialogTitle>
          <DialogDescription>
            Manage your API keys for AI analysis services. Keys are stored securely and encrypted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Key Section */}
          {!isAddingKey ? (
            <div className="flex justify-end">
              <Button onClick={() => setIsAddingKey(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add API Key
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add New API Key</CardTitle>
                <CardDescription>
                  Enter your API key details. The key will be validated before storage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider">Provider</Label>
                      <Select
                        value={newKeyData.provider}
                        onValueChange={(value) => setNewKeyData(prev => ({ ...prev, provider: value as LLMProvider }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                {getProviderIcon(key as LLMProvider)}
                                {provider.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="key-name">Key Name</Label>
                      <Input
                        id="key-name"
                        placeholder="e.g., Production Key, Test Key"
                        value={newKeyData.key_name}
                        onChange={(e) => setNewKeyData(prev => ({ ...prev, key_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        placeholder="Enter your API key..."
                        value={newKeyData.api_key}
                        onChange={(e) => setNewKeyData(prev => ({ ...prev, api_key: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {LLM_PROVIDERS[newKeyData.provider].description}
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddingKey(false);
                        setNewKeyData({
                          provider: 'openai',
                          key_name: '',
                          api_key: ''
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addKeyMutation.isPending || validatingKey}
                    >
                      {validatingKey ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Validating...
                        </>
                      ) : addKeyMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Add Key
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Existing Keys List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your API Keys</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : apiKeys.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No API keys configured</h3>
                  <p className="text-gray-600">
                    Add your first API key to start using AI analysis features
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <Card key={key.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getProviderIcon(key.provider)}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{key.key_name}</h4>
                              <Badge className={getProviderColor(key.provider)}>
                                {LLM_PROVIDERS[key.provider].name}
                              </Badge>
                              {key.is_active ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-600 border-gray-600">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Usage: {key.usage_count} times</span>
                              {key.last_used_at && (
                                <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>
                              )}
                              <span>Added: {new Date(key.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this API key?')) {
                              deleteKeyMutation.mutate(key.id);
                            }
                          }}
                          disabled={deleteKeyMutation.isPending}
                        >
                          {deleteKeyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Security Notice */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Security Notice</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Your API keys are encrypted and stored securely. They are only used for AI analysis 
                    and never shared with third parties. You can delete keys at any time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};