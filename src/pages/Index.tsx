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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-ocean shadow-ocean">
            <Anchor className="w-10 h-10 text-primary-foreground" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
              Navigate Your Tasks with
              <span className="block bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Nautilus
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The adaptive task engine built for frontline teams. Intelligent scheduling, 
              real-time tracking, and AI-powered insights to keep your operations running smoothly.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Get Started
              <Zap className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
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
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6 p-12 rounded-3xl gradient-ocean shadow-ocean">
          <h2 className="text-3xl lg:text-4xl font-bold text-primary-foreground">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-lg text-primary-foreground/90">
            Join teams using Nautilus to streamline their task management and boost efficiency.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            onClick={() => navigate("/auth")}
            className="text-lg px-8"
          >
            Start Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Anchor className="w-6 h-6 text-primary" />
              <span className="font-semibold">Project Nautilus</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Project Nautilus. All rights reserved.
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
    <div className="p-6 rounded-2xl border bg-card hover:shadow-ocean transition-smooth">
      <div className="w-12 h-12 rounded-xl gradient-teal flex items-center justify-center mb-4 text-white">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default Index;
