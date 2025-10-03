import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const pinSchema = z.object({
  pin: z.string()
    .regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  confirmPin: z.string(),
}).refine((data) => data.pin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

type PinFormData = z.infer<typeof pinSchema>;

interface SetPinDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
}

export function SetPinDialog({ open, onClose, onSuccess, userId, userName }: SetPinDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<PinFormData>({
    resolver: zodResolver(pinSchema),
    defaultValues: {
      pin: '',
      confirmPin: '',
    },
  });

  const onSubmit = async (data: PinFormData) => {
    setLoading(true);
    try {
      // Hash the PIN using bcrypt
      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(data.pin, 10);

      // Update the profile with the hashed PIN
      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: pinHash })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `PIN set successfully for ${userName}`,
      });

      form.reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error setting PIN:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set PIN',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Kiosk PIN</DialogTitle>
          <DialogDescription>
            Set a 4-6 digit PIN for {userName} to use at kiosk stations
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter 4-6 digit PIN"
                      maxLength={6}
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter a 4-6 digit numeric PIN
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Re-enter PIN"
                      maxLength={6}
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Setting PIN...' : 'Set PIN'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
