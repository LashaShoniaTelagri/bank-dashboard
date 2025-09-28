import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { 
  Send, 
  Paperclip, 
  MessageSquare, 
  User, 
  Brain,
  FileText,
  Image,
  Download
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "./ui/use-toast";
import { ChatMessage, UserRole } from "../types/specialist";

interface ChatInterfaceProps {
  farmerId: string;
  farmerName: string;
  sessionId?: string;
  onClose?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  farmerId,
  farmerName,
  sessionId,
  onClose
}) => {
  const { profile, user } = useAuth();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  // Fetch chat messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', farmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!farmerId,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string; attachments?: File[] }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          farmer_id: farmerId,
          bank_id: profile?.bank_id || '',
          sender_id: profile?.user_id || '',
          sender_role: profile?.role as UserRole || 'specialist',
          message: messageData.message,
          attachments: messageData.attachments?.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size
          })) || [],
          session_id: sessionId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['chat-messages', farmerId] });
    },
    onError: (error) => {
      console.error('Send message error:', error);
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .in('id', messageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', farmerId] });
    }
  });

  // Handle message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    sendMessageMutation.mutate({ message: message.trim() });
  };

  // Handle file attachment
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // For now, just show file info in message
      const fileNames = Array.from(files).map(file => file.name).join(', ');
      setMessage(prev => prev + ` [Attached: ${fileNames}]`);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when component mounts
  useEffect(() => {
    const unreadMessages = messages
      .filter(msg => !msg.is_read && msg.sender_id !== profile?.user_id)
      .map(msg => msg.id);
    
    if (unreadMessages.length > 0) {
      markAsReadMutation.mutate(unreadMessages);
    }
  }, [messages, profile?.user_id]);

  // Get sender avatar
  const getSenderAvatar = (senderRole: UserRole, senderId: string) => {
    const isCurrentUser = senderId === profile?.user_id;
    
    if (isCurrentUser) {
      return (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-600 text-white">
            {profile?.role === 'specialist' ? 'S' : 'U'}
          </AvatarFallback>
        </Avatar>
      );
    }

    switch (senderRole) {
      case 'specialist':
        return (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-green-600 text-white">
              <Brain className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        );
      case 'farmer':
        return (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-orange-600 text-white">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        );
      case 'admin':
        return (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-purple-600 text-white">
              A
            </AvatarFallback>
          </Avatar>
        );
      default:
        return (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-600 text-white">
              U
            </AvatarFallback>
          </Avatar>
        );
    }
  };

  // Get sender name
  const getSenderName = (senderRole: UserRole, senderId: string) => {
    const isCurrentUser = senderId === profile?.user_id;
    
    if (isCurrentUser) {
      return profile?.role === 'specialist' ? 'You (Specialist)' : 'You';
    }

    switch (senderRole) {
      case 'specialist':
        return 'Agricultural Specialist';
      case 'farmer':
        return farmerName;
      case 'admin':
        return 'Administrator';
      default:
        return 'User';
    }
  };

  // Get attachment icon
  const getAttachmentIcon = (attachment: any) => {
    if (attachment.type?.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat with {farmerName}
            </CardTitle>
            <CardDescription>
              Communicate about analysis and data
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No messages yet</p>
                <p className="text-sm text-gray-500">Start a conversation with {farmerName}</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.sender_id === profile?.user_id ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {getSenderAvatar(msg.sender_role, msg.sender_id)}
                <div
                  className={`max-w-[70%] ${
                    msg.sender_id === profile?.user_id ? 'items-end' : 'items-start'
                  } flex flex-col gap-1`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {getSenderName(msg.sender_role, msg.sender_id)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                    {!msg.is_read && msg.sender_id !== profile?.user_id && (
                      <Badge variant="outline" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      msg.sender_id === profile?.user_id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className={`flex items-center gap-2 p-2 rounded ${
                              msg.sender_id === profile?.user_id
                                ? 'bg-primary/90 text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {getAttachmentIcon(attachment)}
                            <span className="text-xs">{attachment.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                // Handle file download
                                toast({
                                  title: "File download",
                                  description: `Downloading ${attachment.name}`,
                                });
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={sendMessageMutation.isPending}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileAttach}
                className="hidden"
              />
            </div>
            <Button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};