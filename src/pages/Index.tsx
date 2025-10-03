import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Anchor, CheckCircle2, Users, Calendar, BarChart3, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      
      if (profile?.org_id) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
    }
  };

  return (
    <div className="min-h-screen gradient-depth relative overflow-hidden">
      {/* Ornamental background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-32 h-32 border-2 border-[hsl(var(--brass))] rounded-full"></div>
        <div className="absolute bottom-40 right-20 w-24 h-24 border-2 border-[hsl(var(--brass))] rounded-full"></div>
        <div className="absolute top-1/2 right-10 w-16 h-16 border border-[hsl(var(--verdigris))] rounded-full"></div>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center space-y-10 max-w-5xl mx-auto ornamental-corner py-16">
          {/* Victorian Porthole Icon */}
          <div className="inline-flex items-center justify-center w-32 h-32 porthole gradient-depth animate-glow relative">
            <div className="absolute inset-2 rounded-full gradient-porthole"></div>
            <Anchor className="w-16 h-16 text-[hsl(var(--brass-light))] relative z-10 drop-shadow-[0_0_10px_hsl(var(--primary-glow))]" />
            {/* Additional rivets */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-[hsl(var(--rivet))] rounded-full -ml-1"></div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-[hsl(var(--rivet))] rounded-full -mr-1"></div>
          </div>
          
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-4 opacity-60">
            <div className="h-px w-24 bg-gradient-to-r from-transparent to-[hsl(var(--brass))]"></div>
            <div className="w-2 h-2 bg-[hsl(var(--brass))] rounded-full"></div>
            <div className="h-px w-24 bg-gradient-to-l from-transparent to-[hsl(var(--brass))]"></div>
          </div>

          <div className="space-y-6">
            <p className="text-sm tracking-[0.3em] uppercase text-[hsl(var(--brass-light))] font-playfair">
              Navigate Your Tasks with
            </p>
            <h1 className="font-playfair text-6xl lg:text-8xl font-bold tracking-tight">
              <span className="text-brass drop-shadow-[0_2px_10px_hsl(var(--brass)/0.5)]">
                Project
              </span>
              <br />
              <span className="text-[hsl(var(--primary-foreground))] text-7xl lg:text-9xl italic">
                Nautilus
              </span>
            </h1>
            
            {/* Decorative subtitle divider */}
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-[hsl(var(--brass))]"></div>
              <div className="w-1 h-1 bg-[hsl(var(--brass))] rounded-full"></div>
              <div className="w-1 h-1 bg-[hsl(var(--brass))] rounded-full"></div>
              <div className="w-1 h-1 bg-[hsl(var(--brass))] rounded-full"></div>
              <div className="h-px w-12 bg-[hsl(var(--brass))]"></div>
            </div>

            <p className="text-lg lg:text-xl text-[hsl(var(--primary-foreground)/0.9)] max-w-3xl mx-auto font-light italic">
              "The adaptive task engine built for frontline teams—intelligent scheduling, 
              real-time tracking, and AI-powered insights to keep your operations running smoothly."
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")} 
              className="text-lg px-10 gradient-brass text-[hsl(var(--primary))] hover:shadow-brass transition-smooth font-semibold border-2 border-[hsl(var(--brass-dark))]"
            >
              Embark on Your Journey
              <Zap className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-10 border-2 border-[hsl(var(--brass))] text-[hsl(var(--brass-light))] hover:bg-[hsl(var(--brass)/0.1)] transition-smooth"
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center mb-12">
          <h2 className="font-playfair text-4xl font-bold text-brass mb-4">
            Captain's Instruments
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-[hsl(var(--brass))]"></div>
            <div className="w-1.5 h-1.5 bg-[hsl(var(--brass))] rounded-full"></div>
            <div className="h-px w-16 bg-[hsl(var(--brass))]"></div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<CheckCircle2 className="w-8 h-8" />}
            title="Smart Scheduling"
            description="Deterministic task engine with urgency-based ordering"
          />
          <FeatureCard
            icon={<Users className="w-8 h-8" />}
            title="Team Collaboration"
            description="Role-based access and dual sign-off support"
          />
          <FeatureCard
            icon={<Calendar className="w-8 h-8" />}
            title="Flexible Schedules"
            description="Daily, weekly, monthly, and context-aware tasks"
          />
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8" />}
            title="Audit & Reports"
            description="Complete visibility with comprehensive analytics"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 p-16 rounded-3xl border-4 border-[hsl(var(--brass))] bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] shadow-brass relative overflow-hidden">
          {/* Decorative corner elements */}
          <div className="absolute top-0 left-0 w-20 h-20 border-r-2 border-b-2 border-[hsl(var(--brass-light)/0.3)]"></div>
          <div className="absolute top-0 right-0 w-20 h-20 border-l-2 border-b-2 border-[hsl(var(--brass-light)/0.3)]"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 border-r-2 border-t-2 border-[hsl(var(--brass-light)/0.3)]"></div>
          <div className="absolute bottom-0 right-0 w-20 h-20 border-l-2 border-t-2 border-[hsl(var(--brass-light)/0.3)]"></div>
          
          <div className="relative z-10">
            <h2 className="font-playfair text-4xl lg:text-5xl font-bold text-[hsl(var(--primary-foreground))] mb-2">
              Ready to Chart New Waters?
            </h2>
            <div className="flex items-center justify-center gap-3 my-6">
              <div className="h-px w-20 bg-[hsl(var(--brass-light))]"></div>
              <div className="w-2 h-2 bg-[hsl(var(--brass-light))] rounded-full"></div>
              <div className="h-px w-20 bg-[hsl(var(--brass-light))]"></div>
            </div>
            <p className="text-lg lg:text-xl text-[hsl(var(--primary-foreground)/0.95)] italic max-w-2xl mx-auto">
              Join the crews navigating their operations with precision and Victorian elegance.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="mt-8 text-lg px-12 gradient-brass text-[hsl(var(--primary))] hover:shadow-brass transition-smooth font-semibold border-2 border-[hsl(var(--brass-dark))]"
            >
              Begin Your Voyage
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[hsl(var(--brass)/0.3)] mt-20 relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--brass))] flex items-center justify-center">
                <Anchor className="w-5 h-5 text-[hsl(var(--brass-light))]" />
              </div>
              <span className="font-playfair font-semibold text-[hsl(var(--brass-light))]">Project Nautilus</span>
            </div>
            <p className="text-sm text-[hsl(var(--primary-foreground)/0.7)] font-light">
              © 2025 Project Nautilus. Charting depths unknown.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="group p-8 rounded-2xl border-2 border-[hsl(var(--brass)/0.3)] bg-[hsl(var(--card)/0.8)] backdrop-blur-sm hover:border-[hsl(var(--brass))] hover:shadow-brass transition-smooth relative overflow-hidden">
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-12 h-12 border-l-2 border-b-2 border-[hsl(var(--brass)/0.2)] group-hover:border-[hsl(var(--brass)/0.5)] transition-smooth"></div>
      
      <div className="w-14 h-14 rounded-full border-2 border-[hsl(var(--brass))] gradient-brass flex items-center justify-center mb-6 text-[hsl(var(--primary))] shadow-brass group-hover:scale-110 transition-smooth">
        {icon}
      </div>
      <h3 className="font-playfair text-xl font-semibold mb-3 text-brass">{title}</h3>
      <p className="text-sm text-[hsl(var(--primary-foreground)/0.8)] leading-relaxed">{description}</p>
    </div>
  );
}

export default Index;
