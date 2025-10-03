import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LocationForm } from '@/components/LocationForm';
import { AreaForm } from '@/components/AreaForm';
import { ArrowLeft, Plus, MapPin, Edit, Trash2, Archive, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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

  useEffect(() => {
    if (!roleLoading && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [roleLoading, isAdmin, navigate]);

  useEffect(() => {
    loadLocations();

    const channel = supabase
      .channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, loadLocations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'areas' }, loadLocations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLocations = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        areas(*)
      `)
      .is('archived_at', null)
      .order('name');

    if (error) {
      toast.error(error.message);
    } else {
      setLocations(data || []);
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
    if (!confirm('Delete this area? This cannot be undone.')) return;

    const { error } = await supabase
      .from('areas')
      .delete()
      .eq('id', areaId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Area deleted');
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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">Locations & Areas</h1>
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
                              {location.areas?.length || 0} areas
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
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Grid3x3 className="h-4 w-4" />
                            Areas within {location.name}
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddArea(location.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Area
                          </Button>
                        </div>

                        {location.areas && location.areas.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {location.areas.map((area: any) => (
                              <div
                                key={area.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                              >
                                <span className="font-medium">{area.name}</span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditArea(area, location.id)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteArea(area.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            No areas yet. Add areas to organize tasks within this location.
                          </p>
                        )}
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

        <AreaForm
          locationId={selectedLocationForArea}
          area={selectedArea}
          open={areaFormOpen}
          onClose={() => {
            setAreaFormOpen(false);
            setSelectedArea(null);
          }}
          onSuccess={loadLocations}
        />
      </div>
    </div>
  );
}
