import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Users, MapPin, ListTodo, Calendar, Monitor, Sparkles } from "lucide-react";

interface ChecklistItem {
  label: string;
  href: string;
  icon: React.ElementType;
  done: boolean;
}

export default function SetupChecklist({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    check();
  }, [orgId]);

  const check = async () => {
    // Check org age
    const { data: org } = await supabase
      .from("organizations")
      .select("created_at")
      .eq("id", orgId)
      .single();

    if (!org) return;

    const ageMs = Date.now() - new Date(org.created_at).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > sevenDays) return;

    // Run all counts in parallel
    const [profilesRes, locationsRes, routinesRes, shiftsRes, completionsRes] =
      await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("locations").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("task_routines").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("shifts").select("id, location_id", { count: "exact" }).limit(50),
        supabase.from("completions").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      ]);

    const profileCount = profilesRes.count ?? 0;
    if (profileCount >= 2) {
      // Org has team members already — check if we should still show
    }

    const locationCount = locationsRes.count ?? 0;
    const routineCount = routinesRes.count ?? 0;
    const shiftCount = shiftsRes.count ?? 0;
    const completionCount = completionsRes.count ?? 0;

    // Only show if < 2 team members invited
    if (profileCount >= 3) return; // owner + 2 others = established

    const checklist: ChecklistItem[] = [
      {
        label: "Invite your first team member",
        href: "/users",
        icon: Users,
        done: profileCount > 1,
      },
      {
        label: "Add more departments or locations",
        href: "/locations",
        icon: MapPin,
        done: locationCount > 1,
      },
      {
        label: "Review your task routines",
        href: "/task-routines",
        icon: ListTodo,
        done: routineCount > 0,
      },
      {
        label: "Set up additional shifts",
        href: "/shifts",
        icon: Calendar,
        done: shiftCount > 1,
      },
      {
        label: "Complete a test task on the kiosk",
        href: "/kiosk",
        icon: Monitor,
        done: completionCount > 0,
      },
    ];

    const done = checklist.every((i) => i.done);
    setAllDone(done);
    setItems(checklist);
    setVisible(true);
  };

  if (!visible || !items) return null;

  if (allDone) {
    return (
      <Card className="p-4 bg-success/5 border-success/20">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Setup complete — your team is ready to go.</span>
        </div>
      </Card>
    );
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="p-5 bg-primary/[0.03] border-primary/10">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Getting Started</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {doneCount}/{items.length} complete
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm transition-base ${
                item.done
                  ? "text-muted-foreground"
                  : "hover:bg-primary/5 text-foreground"
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 shrink-0" />
              )}
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className={item.done ? "line-through" : ""}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
