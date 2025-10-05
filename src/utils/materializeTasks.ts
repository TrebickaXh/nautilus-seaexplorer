import { supabase } from "@/integrations/supabase/client";

export async function triggerTaskMaterialization() {
  const { data, error } = await supabase.functions.invoke('materialize-tasks-v2', {
    body: {}
  });
  
  if (error) {
    console.error('Failed to trigger materialization:', error);
    throw error;
  }
  
  return data;
}
