import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InviteUserDialog } from '@/components/InviteUserDialog';
import { SetPinDialog } from '@/components/SetPinDialog';
import { ArrowLeft, UserPlus, Shield, Users as UsersIcon, User, KeyRound } from 'lucide-react';

interface UserProfile {
  id: string;
  display_name: string;
  active: boolean;
  email?: string;
  phone?: string;
  department?: string;
  employee_id?: string;
  shift_type?: string;
  last_login?: string;
  user_roles?: { role: string }[];
}

export default function Users() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [orgId, setOrgId] = useState<string>('');

  useEffect(() => {
    if (!roleLoading && !isAdmin()) {
      navigate('/dashboard');
      return;
    }
    loadUsers();
  }, [roleLoading, isAdmin, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's org_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.org_id);

      // Get all users in the same org with their roles
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          active,
          email,
          phone,
          department,
          employee_id,
          shift_type,
          last_login,
          user_roles (
            role
          )
        `)
        .eq('org_id', profile.org_id)
        .order('display_name');

      if (error) throw error;

      setUsers(data as any);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'org_admin' | 'location_manager' | 'crew') => {
    try {
      // Delete existing role
      await supabase.from('user_roles').delete().eq('user_id', userId);

      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'org_admin':
        return 'default';
      case 'location_manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'org_admin':
        return <Shield className="h-3 w-3" />;
      case 'location_manager':
        return <UsersIcon className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const formatRoleName = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Team Management</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your organization's team members
                </p>
              </div>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              View and manage roles for all users in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.display_name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{user.employee_id || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">{user.department || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.user_roles?.[0] ? (
                          <Badge variant={getRoleBadgeVariant(user.user_roles[0].role)}>
                            {getRoleIcon(user.user_roles[0].role)}
                            <span className="ml-1">{formatRoleName(user.user_roles[0].role)}</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline">No Role</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? 'default' : 'secondary'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.user_roles?.[0]?.role || 'crew'}
                          onValueChange={(value) => updateUserRole(user.id, value as 'org_admin' | 'location_manager' | 'crew')}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Change role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="crew">Crew</SelectItem>
                            <SelectItem value="location_manager">Location Manager</SelectItem>
                            <SelectItem value="org_admin">Organization Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.active)}
                        >
                          {user.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser({ id: user.id, name: user.display_name });
                            setPinDialogOpen(true);
                          }}
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Set PIN
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <InviteUserDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        onSuccess={loadUsers}
        orgId={orgId}
      />

      {selectedUser && (
        <SetPinDialog
          open={pinDialogOpen}
          onClose={() => {
            setPinDialogOpen(false);
            setSelectedUser(null);
          }}
          onSuccess={loadUsers}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}
    </div>
  );
}
