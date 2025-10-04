import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  display_name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['org_admin', 'location_manager', 'crew']),
  phone: z.string().optional(),
  location_id: z.string().min(1, 'Location is required'),
  department_id: z.string().min(1, 'Department is required'),
  employee_id: z.string().optional(),
  shift_type: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
}

export function InviteUserDialog({ open, onClose, onSuccess, orgId }: InviteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      display_name: '',
      role: 'crew',
      phone: '',
      location_id: '',
      department_id: '',
      employee_id: '',
      shift_type: '',
    },
  });

  const selectedLocation = form.watch('location_id');

  useEffect(() => {
    if (open) {
      loadLocations();
    }
  }, [open]);

  useEffect(() => {
    if (selectedLocation) {
      loadDepartments(selectedLocation);
      form.setValue('department_id', '');
    } else {
      setDepartments([]);
    }
  }, [selectedLocation]);

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name')
      .is('archived_at', null)
      .order('name');
    
    if (data) {
      setLocations(data);
    }
  };

  const loadDepartments = async (locationId: string) => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('location_id', locationId)
      .is('archived_at', null)
      .order('name');
    
    if (data) {
      setDepartments(data);
    }
  };

  const onSubmit = async (data: InviteFormData) => {
    setLoading(true);
    try {
      // Create user via edge function without sending email
      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: data.email,
          displayName: data.display_name,
          role: data.role,
          phone: data.phone || '',
          departmentId: data.department_id,
          employeeId: data.employee_id || '',
          shiftType: data.shift_type || '',
          orgId,
        },
      });

      if (error) {
        // Parse error message if it's a JSON response
        let errorMessage = 'Failed to create team member';
        if (error.message) {
          try {
            const errorData = JSON.parse(error.message);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = error.message;
          }
        }
        throw new Error(errorMessage);
      }

      toast.success(`Team member ${data.display_name} created successfully`);

      form.reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Create a new team member account. They can set their password on first login.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="crew">Crew</SelectItem>
                      <SelectItem value="location_manager">Location Manager</SelectItem>
                      <SelectItem value="org_admin">Organization Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="EMP-001"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loading || !selectedLocation}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedLocation ? "Select a department" : "Select location first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shift_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift Type (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Morning, Evening, Night"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Team Member
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
