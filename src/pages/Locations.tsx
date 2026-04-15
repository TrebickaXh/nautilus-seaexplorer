import { useEffect, useState } from 'react';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LocationForm } from '@/components/LocationForm';
import { DepartmentForm } from '@/components/DepartmentForm';
import { ArrowLeft, Plus, MapPin, Edit, Trash2, Archive, Grid3x3, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';

export default function Locations() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [areaFormOpen, setAreaFormOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [selectedLocationForArea, setSelectedLocationForArea] = useState<string>('');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  // Zone (area) form state
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [zoneLocationId, setZoneLocationId] = useState<string>('');
  const [editingZone, setEditingZone] = useState<any>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneSaving, setZoneSaving] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isAdmin, navigate]);

  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgId = async () => {
      const { data } = await supabase.rpc('get_user_org_id');
      if (data) setOrgId(data);
    };
    fetchOrgId();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    loadLocations();

    const channel = supabase
      .channel('locations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'locations',
        filter: `org_id=eq.${orgId}`,
      }, loadLocations)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'departments',
      }, loadLocations)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'areas',
      }, loadLocations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const loadLocations = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        departments(*),
        areas(*)
      `)
      .is('archived_at', null)
      .order('name');

    if (error) {
      toast.error(error.message);
    } else {
      const filtered = (data || []).map(loc => ({
        ...loc,
        departments: (loc.departments || []).filter((d: any) => !d.archived_at),
        areas: (loc.areas || []).filter((a: any) => !a.archived_at),
      }));
      setLocations(filtered);
    }

    setLoading(false);
  };

  const handleEditLocation = (location: any) => {
    setSelectedLocation(location);
    setLocationFormOpen(true);
  };

  const handleArchiveLocation = async (locationId: string) => {
    if (!confirm('Archive this location? This will hide it from active use.')) return;

    const { error } = await supabase
      .from('locations')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', locationId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Location archived');
      loadLocations();
    }
  };

  const handleAddArea = (locationId: string) => {
    setSelectedLocationForArea(locationId);
    setSelectedArea(null);
    setAreaFormOpen(true);
  };

  const handleEditArea = (area: any, locationId: string) => {
    setSelectedLocationForArea(locationId);
    setSelectedArea(area);
    setAreaFormOpen(true);
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!confirm('Delete this department? This cannot be undone.')) return;

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', areaId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Department deleted');
      loadLocations();
    }
  };

  // Zone (area) handlers
  const openZoneForm = (locationId: string, zone?: any) => {
    setZoneLocationId(locationId);
    setEditingZone(zone || null);
    setZoneName(zone?.name || '');
    setZoneFormOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneName.trim()) {
      toast.error('Area name is required');
      return;
    }
    setZoneSaving(true);
    try {
      if (editingZone) {
        const { error } = await supabase
          .from('areas')
          .update({ name: zoneName.trim() })
          .eq('id', editingZone.id);
        if (error) throw error;
        toast.success('Area updated');
      } else {
        const { error } = await supabase
          .from('areas')
          .insert({ location_id: zoneLocationId, name: zoneName.trim() });
        if (error) throw error;
        toast.success('Area created');
      }
      setZoneFormOpen(false);
      loadLocations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setZoneSaving(false);
    }
  };

  const handleArchiveZone = async (zoneId: string) => {
    if (!confirm('Archive this area? It will be hidden from active use.')) return;
    const { error } = await supabase
      .from('areas')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', zoneId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Area archived');
      loadLocations();
    }
  };

  const toggleLocation = (locationId: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(locationId)) {
        newSet.delete(locationId);
      } else {
        newSet.add(locationId);
      }
      return newSet;
    });
  };

  if (roleLoading || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Locations & Departments</h1>
          </div>
          <Button onClick={() => {
            setSelectedLocation(null);
            setLocationFormOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>

        {locations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No locations yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first location to start organizing tasks by physical spaces
              </p>
              <Button onClick={() => setLocationFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Location
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {locations.map(location => (
              <Card key={location.id}>
                <CardHeader>
                  <Collapsible
                    open={expandedLocations.has(location.id)}
                    onOpenChange={() => toggleLocation(location.id)}
                  >
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 cursor-pointer flex-1">
                          <ChevronDown
                            className={`h-5 w-5 transition-transform ${
                              expandedLocations.has(location.id) ? 'rotate-180' : ''
                            }`}
                          />
                          <MapPin className="h-5 w-5 text-primary" />
                          <div>
                            <CardTitle>{location.name}</CardTitle>
                            <CardDescription>
                              {location.departments?.length || 0} departments · {location.areas?.length || 0} areas
                              {location.latitude && location.longitude && (
                                <span className="ml-2">
                                  • {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                </span>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditLocation(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveLocation(location.id)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <CardContent className="pt-4 space-y-6">
                        {/* Departments Section */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Grid3x3 className="h-4 w-4" />
                              Departments
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddArea(location.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Department
                            </Button>
                          </div>

                          {location.departments && location.departments.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {location.departments.map((dept: any) => (
                                <div
                                  key={dept.id}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                >
                                  <span className="font-medium">{dept.name}</span>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditArea(dept, location.id)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteArea(dept.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              No departments yet. Add departments to organize tasks within this location.
                            </p>
                          )}
                        </div>

                        {/* Areas (Zones) Section */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              Areas
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openZoneForm(location.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Area
                            </Button>
                          </div>

                          {location.areas && location.areas.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {location.areas.map((zone: any) => (
                                <div
                                  key={zone.id}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                >
                                  <span className="font-medium">{zone.name}</span>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openZoneForm(location.id, zone)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleArchiveZone(zone.id)}
                                    >
                                      <Archive className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              No areas yet. Add areas like "Kitchen", "Lobby", or "Bar" to assign tasks to specific zones.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <LocationForm
          location={selectedLocation}
          open={locationFormOpen}
          onClose={() => {
            setLocationFormOpen(false);
            setSelectedLocation(null);
          }}
          onSuccess={loadLocations}
        />

        <DepartmentForm
          locationId={selectedLocationForArea}
          department={selectedArea}
          open={areaFormOpen}
          onSuccess={() => {
            loadLocations();
            setAreaFormOpen(false);
          }}
          onCancel={() => setAreaFormOpen(false)}
        />

        {/* Area (Zone) Form Dialog */}
        <Dialog open={zoneFormOpen} onOpenChange={setZoneFormOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingZone ? 'Edit Area' : 'Add Area'}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {editingZone ? 'Update the name of this area.' : 'Create a new area within this location.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="zone-name">Area Name</Label>
                <Input
                  id="zone-name"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder='e.g. "Kitchen", "Lobby", "Bar"'
                  disabled={zoneSaving}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setZoneFormOpen(false)} disabled={zoneSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveZone} disabled={zoneSaving || !zoneName.trim()}>
                {editingZone ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
