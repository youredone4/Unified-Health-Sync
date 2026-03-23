import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send, Search, ArrowLeft, Users, Globe } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  userId: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isSentByMe: boolean;
}

interface DMessage {
  id: number;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface UserResult {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface GlobalChatMessage {
  id: number;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

function getInitials(firstName: string | null, lastName: string | null, username: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  return username[0].toUpperCase();
}

function getDisplayName(firstName: string | null, lastName: string | null, username: string): string {
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(' ');
  return username;
}

function formatTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: "Admin",
  MHO: "MHO",
  SHA: "SHA",
  TL: "BHW",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function roleBadgeColor(role: string) {
  switch (role) {
    case "SYSTEM_ADMIN": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "MHO": return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "SHA": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "TL": return "bg-green-500/20 text-green-400 border-green-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

// ============================================================
// General Chat Tab
// ============================================================
function GeneralChatTab({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: gcMessages = [], isFetching: loadingGC } = useQuery<GlobalChatMessage[]>({
    queryKey: ['/api/general-chat/messages'],
    refetchInterval: 5000,
  });

  const sendGCMutation = useMutation({
    mutationFn: async (content: string) =>
      apiRequest('POST', '/api/general-chat/messages', { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/general-chat/messages'] });
      setMessageText("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gcMessages]);

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendGCMutation.mutate(messageText.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <ScrollArea className="flex-1 px-4 py-4">
        {loadingGC && gcMessages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Loading messages…</p>
        )}
        {gcMessages.length === 0 && !loadingGC && (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="gc-empty-state">
            <Globe className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to say something to the team!</p>
          </div>
        )}
        <div className="space-y-3">
          {gcMessages.map(msg => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                data-testid={`gc-message-${msg.id}`}
              >
                <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs font-medium text-foreground">{isMe ? 'You' : msg.senderName}</span>
                    <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0 leading-5 ${roleBadgeColor(msg.senderRole)}`}>
                      {roleLabel(msg.senderRole)}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-4 py-2 text-sm ${isMe
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card">
        <Input
          placeholder="Message the team…"
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          data-testid="input-gc-message"
          maxLength={2000}
        />
        <Button
          onClick={handleSend}
          disabled={!messageText.trim() || sendGCMutation.isPending}
          size="sm"
          className="gap-1"
          data-testid="button-gc-send"
        >
          <Send className="w-4 h-4" />
          Send
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Direct Messages Tab
// ============================================================
function DirectMessagesTab({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/dm/conversations'],
    refetchInterval: 5000,
  });

  const { data: messages = [], isFetching: loadingMessages } = useQuery<DMessage[]>({
    queryKey: ['/api/dm/messages', activeUserId],
    enabled: !!activeUserId,
    refetchInterval: 5000,
  });

  const { data: searchResults = [] } = useQuery<UserResult[]>({
    queryKey: ['/api/users', searchQuery],
    enabled: searchQuery.length >= 2,
    queryFn: () => fetch(`/api/users?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string; content: string }) =>
      apiRequest('POST', '/api/dm/messages', { receiverId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm/messages', activeUserId] });
      queryClient.invalidateQueries({ queryKey: ['/api/dm/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dm/unread-count'] });
      setMessageText("");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (otherUserId: string) =>
      apiRequest('POST', `/api/dm/read/${otherUserId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dm/unread-count'] });
    },
  });

  const openThread = useCallback((userId: string) => {
    setActiveUserId(userId);
    setShowMobileThread(true);
    setShowSearch(false);
    setSearchQuery("");
    markReadMutation.mutate(userId);
  }, []);

  useEffect(() => {
    if (activeUserId) {
      markReadMutation.mutate(activeUserId);
    }
  }, [messages.length, activeUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!activeUserId || !messageText.trim()) return;
    sendMutation.mutate({ receiverId: activeUserId, content: messageText });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConversation = conversations.find(c => c.userId === activeUserId);
  const activeSearchUser = searchResults.find(u => u.id === activeUserId);
  const activeDisplayName = activeConversation
    ? getDisplayName(activeConversation.firstName, activeConversation.lastName, activeConversation.username)
    : activeSearchUser
    ? getDisplayName(activeSearchUser.firstName, activeSearchUser.lastName, activeSearchUser.username)
    : activeUserId ?? null;

  const activeUser = activeConversation
    ? { firstName: activeConversation.firstName, lastName: activeConversation.lastName, username: activeConversation.username }
    : activeSearchUser
    ? { firstName: activeSearchUser.firstName, lastName: activeSearchUser.lastName, username: activeSearchUser.username }
    : null;

  return (
    <div className="flex gap-0 overflow-hidden rounded-b-lg border border-t-0 border-border flex-1 min-h-0">
      {/* Left Panel — Conversations */}
      <div className={`${showMobileThread ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border bg-card flex-shrink-0`}>
        {/* Search bar */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users to message…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(e.target.value.length >= 2); }}
              className="pl-8"
              data-testid="input-search-users"
            />
          </div>
        </div>

        {/* Search results */}
        {showSearch && searchResults.length > 0 && (
          <div className="border-b border-border">
            <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">New conversation</p>
            {searchResults.map(u => (
              <button
                key={u.id}
                onClick={() => openThread(u.id)}
                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                data-testid={`search-result-${u.id}`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">
                    {getInitials(u.firstName, u.lastName, u.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{getDisplayName(u.firstName, u.lastName, u.username)}</p>
                  <p className="text-xs text-muted-foreground">{u.role} · @{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground border-b border-border">
            No users found for "{searchQuery}"
          </div>
        )}

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {conversations.length === 0 && !showSearch && (
            <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
              <Users className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Search for a colleague above to start a chat</p>
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.userId}
              onClick={() => openThread(conv.userId)}
              className={`flex items-center gap-3 w-full px-3 py-3 hover:bg-muted/50 text-left transition-colors border-b border-border/50 ${activeUserId === conv.userId ? 'bg-muted' : ''}`}
              data-testid={`conversation-${conv.userId}`}
            >
              <Avatar className="w-10 h-10 flex-shrink-0">
                <AvatarFallback className={`text-sm ${conv.unreadCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                  {getInitials(conv.firstName, conv.lastName, conv.username)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
                    {getDisplayName(conv.firstName, conv.lastName, conv.username)}
                  </p>
                  {conv.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5 flex-shrink-0" data-testid={`unread-badge-${conv.userId}`}>
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
                <p className={`text-xs mt-0.5 truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {conv.isSentByMe ? <span className="text-muted-foreground">You: </span> : null}
                  {conv.lastMessage}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatTime(conv.lastMessageAt)}</p>
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Right Panel — Chat Thread */}
      <div className={`${!showMobileThread && 'hidden md:flex'} flex-col flex-1 bg-background min-w-0`}>
        {!activeUserId ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
            <p className="text-sm text-muted-foreground mt-1">Or search for a colleague to start messaging</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden -ml-1 p-1"
                onClick={() => { setShowMobileThread(false); setActiveUserId(null); }}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-sm bg-primary/20 text-primary">
                  {activeUser ? getInitials(activeUser.firstName, activeUser.lastName, activeUser.username) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm" data-testid="text-active-user">
                  {activeUser ? getDisplayName(activeUser.firstName, activeUser.lastName, activeUser.username) : activeUserId}
                </p>
                {activeConversation && (
                  <p className="text-xs text-muted-foreground">@{activeConversation.username}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              {loadingMessages && messages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">Loading messages…</p>
              )}
              {messages.length === 0 && !loadingMessages && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">No messages yet</p>
                  <p className="text-xs text-muted-foreground">Send the first message!</p>
                </div>
              )}
              <div className="space-y-3">
                {messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  const senderName = isMe
                    ? (user?.firstName ? [user.firstName, user.lastName].filter(Boolean).join(' ') : user?.username ?? 'Me')
                    : (activeUser ? getDisplayName(activeUser.firstName, activeUser.lastName, activeUser.username) : 'Them');
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`} data-testid={`message-${msg.id}`}>
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <span className="text-xs font-medium text-muted-foreground px-1">{senderName}</span>
                        <div className={`rounded-2xl px-4 py-2 text-sm ${isMe
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card">
              <Input
                ref={inputRef}
                placeholder="Type a message…"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
                data-testid="input-message"
              />
              <Button
                onClick={handleSend}
                disabled={!messageText.trim() || sendMutation.isPending}
                size="sm"
                className="gap-1"
                data-testid="button-send"
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Messages Page
// ============================================================
export default function MessagesPage() {
  const { user } = useAuth();

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Messages</h1>
      </div>

      <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-b-none border border-border bg-card px-2 h-10 flex-shrink-0">
          <TabsTrigger value="general" className="gap-1.5 text-sm" data-testid="tab-general-chat">
            <Globe className="w-4 h-4" />
            General Chat
          </TabsTrigger>
          <TabsTrigger value="direct" className="gap-1.5 text-sm" data-testid="tab-direct-messages">
            <MessageCircle className="w-4 h-4" />
            Direct Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex-1 min-h-0 mt-0 border border-t-0 border-border rounded-b-lg bg-background data-[state=inactive]:hidden flex flex-col">
          <GeneralChatTab user={user} />
        </TabsContent>

        <TabsContent value="direct" className="flex-1 min-h-0 mt-0 flex flex-col data-[state=inactive]:hidden">
          <DirectMessagesTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
