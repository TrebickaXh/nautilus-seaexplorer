import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'org_admin' | 'location_manager' | 'crew';

export const useUserRole = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch all roles
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      const roleList = userRoles?.map(r => r.role as AppRole) || [];
      setRoles(roleList);

      // Determine primary role (highest privilege)
      if (roleList.includes('org_admin')) {
        setPrimaryRole('org_admin');
      } else if (roleList.includes('location_manager')) {
        setPrimaryRole('location_manager');
      } else if (roleList.includes('crew')) {
        setPrimaryRole('crew');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = (): boolean => {
    return hasRole('org_admin') || hasRole('location_manager');
  };

  return {
    roles,
    primaryRole,
    loading,
    hasRole,
    isAdmin,
    refetch: fetchUserRoles,
  };
};
