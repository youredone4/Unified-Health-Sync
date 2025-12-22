import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SmsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: string;
  phone: string | null;
  defaultMessage: string;
}

export default function SmsModal({ open, onOpenChange, recipient, phone, defaultMessage }: SmsModalProps) {
  const [message, setMessage] = useState(defaultMessage);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/sms', {
        recipient,
        recipientPhone: phone || '',
        message,
        sentAt: new Date().toISOString(),
        status: 'Queued (Demo)'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms'] });
      toast({ title: "SMS queued (Demo)", description: `Message sent to ${recipient}` });
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">To:</p>
            <p className="font-medium">{recipient}</p>
            <p className="text-sm text-muted-foreground">{phone || 'No phone number'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Message:</p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              data-testid="input-sms-message"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} data-testid="button-send-sms">
            {sendMutation.isPending ? 'Sending...' : 'Send SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
