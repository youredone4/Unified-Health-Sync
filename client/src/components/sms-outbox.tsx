import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import type { SmsMessage } from "@shared/schema";
import { MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/healthLogic";

interface SmsOutboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SmsOutbox({ open, onOpenChange }: SmsOutboxProps) {
  const { data: messages = [] } = useQuery<SmsMessage[]>({ queryKey: ['/api/sms'] });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS Outbox
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4 max-h-[calc(100vh-200px)] overflow-auto">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No SMS messages sent yet</p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="p-3 rounded-md border border-border bg-card"
              data-testid={`sms-${msg.id}`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium text-sm">{msg.recipient}</p>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                  {msg.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{msg.recipientPhone}</p>
              <p className="text-sm">{msg.message}</p>
              <p className="text-xs text-muted-foreground mt-2">{formatDate(msg.sentAt)}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
