import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ChevronDown, RefreshCw, Loader2 } from "lucide-react";

interface BriefingData {
  yesterdayRate: number;
  skippedTasks: { title: string }[];
  chronicLate: { title: string; lateCount: number }[];
  pendingCount: number;
  activeShifts: number;
}

interface MorningBriefingProps {
  briefingData: BriefingData;
}

function getCacheKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `morning-briefing-${today}`;
}

export default function MorningBriefing({ briefingData }: MorningBriefingProps) {
  const { toast } = useToast();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  // Load from cache on mount
  useEffect(() => {
    const cached = localStorage.getItem(getCacheKey());
    if (cached) setBriefing(cached);
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("morning-briefing", {
        body: briefingData,
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Briefing Error", description: data.error, variant: "destructive" });
        return;
      }

      const text = data.briefing;
      setBriefing(text);
      localStorage.setItem(getCacheKey(), text);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate briefing", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-sm border-primary/10 bg-primary/[0.02]">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-primary/[0.03] transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Morning Briefing</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-5">
            {briefing ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-foreground">{briefing}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={loading}
                  onClick={(e) => { e.stopPropagation(); generate(); }}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                  Regenerate
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); generate(); }}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Generate briefing
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
