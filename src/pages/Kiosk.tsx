import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KioskTaskList } from '@/components/KioskTaskList';
import { LogOut, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function Kiosk() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
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
    // Set current shift time (mock for now)
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

  const handlePinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (pin.length < 4) {
      toast({
        title: 'Invalid PIN',
        description: 'PIN must be at least 4 digits',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // In production, this would verify the PIN hash
      // For now, we'll just check if a user exists with a PIN
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .eq('pin_hash', pin)
        .single();

      if (error || !profiles) {
        toast({
          title: 'Authentication Failed',
          description: 'Invalid PIN. Please try again.',
          variant: 'destructive',
        });
        setPin('');
        return;
      }

      setCurrentUser(profiles);
      setIsAuthenticated(true);
      setPin('');
      
      toast({
        title: 'Welcome!',
        description: `Signed in as ${profiles.display_name}`,
      });
    } catch (error) {
      console.error('PIN auth error:', error);
      toast({
        title: 'Error',
        description: 'Authentication failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    toast({
      title: 'Signed Out',
      description: 'You have been signed out successfully.',
    });
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Kiosk Sign In</CardTitle>
            <p className="text-sm text-muted-foreground text-center">
              Enter your PIN to access tasks
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinAuth} className="space-y-6">
              <div className="relative">
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter PIN"
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <Button
                    key={digit}
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => handlePinInput(digit.toString())}
                    className="text-2xl h-16"
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handlePinBackspace}
                  className="text-xl h-16"
                >
                  ←
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => handlePinInput('0')}
                  className="text-2xl h-16"
                >
                  0
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={pin.length < 4 || loading}
                  className="text-xl h-16"
                >
                  ✓
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{currentUser?.display_name}</h1>
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
            
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Task List */}
      <main className="container mx-auto px-4 py-6">
        <KioskTaskList userId={currentUser?.id} />
      </main>
    </div>
  );
}
