import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Phone, MapPin } from "lucide-react";

const PH_PHONE_RE = /^(09\d{9}|\+639\d{9})$/;

function validatePhone(value: string): string | null {
  if (!value.trim()) return "Phone number is required.";
  if (!PH_PHONE_RE.test(value.trim())) {
    return "Enter a valid Philippine mobile number (e.g. 09171234567 or +639171234567).";
  }
  return null;
}

interface SmsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: string;
  phone: string | null | undefined;
  defaultMessage: string;
  barangay?: string;
  onSavePhone?: (phone: string) => Promise<void>;
}

export default function SmsModal({
  open,
  onOpenChange,
  recipient,
  phone,
  defaultMessage,
  barangay,
  onSavePhone,
}: SmsModalProps) {
  const hasProfilePhone = !!phone && phone.trim() !== '';

  const [message, setMessage] = useState(defaultMessage);
  const [manualPhone, setManualPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saveToProfile, setSaveToProfile] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setMessage(defaultMessage);
      setManualPhone('');
      setPhoneError(null);
      setSaveToProfile(false);
    }
  }, [open, defaultMessage]);

  const effectivePhone = hasProfilePhone ? phone!.trim() : manualPhone.trim();
  const phoneToValidate = hasProfilePhone ? phone!.trim() : manualPhone.trim();
  const phoneValid = validatePhone(phoneToValidate) === null;

  const handlePhoneChange = (val: string) => {
    setManualPhone(val);
    if (val.trim()) {
      setPhoneError(validatePhone(val));
    } else {
      setPhoneError(null);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const resolved = effectivePhone;
      const err = validatePhone(resolved);
      if (err) throw new Error(err);

      await apiRequest('POST', '/api/sms', {
        recipient,
        recipientPhone: resolved,
        message,
        sentAt: new Date().toISOString(),
        status: 'Queued (Demo)',
      });

      if (!hasProfilePhone && saveToProfile && onSavePhone) {
        await onSavePhone(resolved);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms'] });
      toast({ title: "SMS queued (Demo)", description: `Message queued for ${recipient}` });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Could not send SMS", description: err.message, variant: "destructive" });
    },
  });

  const canSend = phoneValid && message.trim().length > 0 && !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Recipient</p>
            <p className="font-medium" data-testid="text-sms-recipient">{recipient}</p>
            {barangay && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span data-testid="text-sms-barangay">{barangay}</span>
              </div>
            )}
          </div>

          {hasProfilePhone ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-green-500" />
                <span className="font-mono" data-testid="text-sms-phone">{phone}</span>
                <span className="text-xs text-green-600 dark:text-green-400">(from profile)</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3 rounded-md bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  No saved phone number found in this profile. Please enter a mobile number to continue.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual-phone" className="text-xs text-muted-foreground">
                  Mobile Number
                </Label>
                <Input
                  id="manual-phone"
                  type="tel"
                  placeholder="e.g. 09171234567"
                  value={manualPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  data-testid="input-sms-phone"
                  className={phoneError ? 'border-destructive' : ''}
                />
                {phoneError && (
                  <p className="text-xs text-destructive" data-testid="text-phone-error">{phoneError}</p>
                )}
              </div>

              {onSavePhone && manualPhone.trim() && !phoneError && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="save-phone"
                    checked={saveToProfile}
                    onCheckedChange={(v) => setSaveToProfile(v === true)}
                    data-testid="checkbox-save-phone"
                  />
                  <Label htmlFor="save-phone" className="text-xs cursor-pointer">
                    Save this number to patient profile
                  </Label>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Message:</p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              data-testid="input-sms-message"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-sms">
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            data-testid="button-send-sms"
          >
            {sendMutation.isPending ? 'Sending...' : 'Send SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
