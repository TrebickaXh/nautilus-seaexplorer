import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ListTodo,
  Calendar,
  FileText,
  MapPin,
  Users,
  Settings,
  LogOut,
  Waves,
  Tablet,
  BarChart3,
  Clock,
} from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

const mainItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['crew', 'location_manager', 'org_admin'] },
  { title: 'My Schedule', url: '/my-schedule', icon: Calendar, roles: ['crew', 'location_manager', 'org_admin'] },
  { title: 'Tasks', url: '/task-instances', icon: ListTodo, roles: ['crew', 'location_manager', 'org_admin'] },
  { title: 'Kiosk', url: '/kiosk', icon: Tablet, roles: ['crew', 'location_manager', 'org_admin'] },
  { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['location_manager', 'org_admin'] },
];

const managementItems = [
  { title: 'Routines', url: '/task-routines', icon: FileText, roles: ['location_manager', 'org_admin'] },
  { title: 'Shifts', url: '/shifts', icon: Clock, roles: ['location_manager', 'org_admin'] },
  { title: 'Schedules', url: '/schedules', icon: Calendar, roles: ['location_manager', 'org_admin'] },
  { title: 'Availability', url: '/employee-availability', icon: Users, roles: ['location_manager', 'org_admin'] },
  { title: 'Locations', url: '/locations', icon: MapPin, roles: ['location_manager', 'org_admin'] },
  { title: 'Team', url: '/users', icon: Users, roles: ['org_admin'] },
];

const systemItems = [
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['crew', 'location_manager', 'org_admin'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryRole } = useUserRole();
  const currentPath = location.pathname;

  const hasAccess = (roles: string[]) => {
    return primaryRole && roles.includes(primaryRole);
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `w-full ${state === 'collapsed' ? 'px-2' : 'justify-start'} ${
      isActive
        ? 'bg-accent text-white font-medium'
        : 'hover:bg-accent/50 transition-colors'
    }`;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <Sidebar className={state === 'collapsed' ? 'w-16' : 'w-52'}>
      <SidebarContent>
        {/* Brand */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-ocean flex items-center justify-center flex-shrink-0">
            <Waves className="w-4 h-4 text-primary-foreground" />
          </div>
          {state !== 'collapsed' && (
            <div className="flex flex-col">
              <h2 className="font-bold text-lg">Nautilus</h2>
              <p className="text-xs text-muted-foreground">Task Management</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className={state === 'collapsed' ? 'sr-only' : ''}>
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems
                .filter(item => hasAccess(item.roles))
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      end
                    >
                      {({ isActive }) => (
                        <Button
                          variant="ghost"
                          className={getNavCls({ isActive })}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                        </Button>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management */}
        {managementItems.some(item => hasAccess(item.roles)) && (
          <SidebarGroup>
            <SidebarGroupLabel className={state === 'collapsed' ? 'sr-only' : ''}>
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managementItems
                  .filter(item => hasAccess(item.roles))
                  .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <NavLink
                        to={item.url}
                        end
                      >
                        {({ isActive }) => (
                          <Button
                            variant="ghost"
                            className={getNavCls({ isActive })}
                          >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                          </Button>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System */}
        <SidebarGroup>
          <SidebarGroupLabel className={state === 'collapsed' ? 'sr-only' : ''}>
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems
                .filter(item => hasAccess(item.roles))
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      end
                    >
                      {({ isActive }) => (
                        <Button
                          variant="ghost"
                          className={getNavCls({ isActive })}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                        </Button>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          className={`w-full ${state === 'collapsed' ? 'px-2' : 'justify-start'}`}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {state !== 'collapsed' && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
