import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KioskTaskList } from '@/components/KioskTaskList';
import { Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Kiosk() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentShift, setCurrentShift] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Set current shift time
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 6 && hours < 14) {
      setCurrentShift('Morning Shift (6 AM - 2 PM)');
    } else if (hours >= 14 && hours < 22) {
      setCurrentShift('Evening Shift (2 PM - 10 PM)');
    } else {
      setCurrentShift('Night Shift (10 PM - 6 AM)');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Task Kiosk</h1>
            <p className="text-sm text-muted-foreground">{currentShift}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Task List */}
      <main className="container mx-auto px-4 py-6">
        <KioskTaskList />
      </main>
    </div>
  );
}
