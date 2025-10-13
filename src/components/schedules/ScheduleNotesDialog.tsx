import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface ScheduleNotesDialogProps {
  shiftId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleNotesDialog({ shiftId, open, onOpenChange }: ScheduleNotesDialogProps) {
  const [newNote, setNewNote] = useState("");
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["shift-notes", shiftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_notes")
        .select(`
          *,
          author:profiles!schedule_notes_author_id_fkey(id, display_name)
        `)
        .eq("shift_id", shiftId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open && !!shiftId,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("schedule_notes")
        .insert({
          shift_id: shiftId,
          author_id: user.id,
          note,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added");
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["shift-notes", shiftId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add note");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("schedule_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note deleted");
      queryClient.invalidateQueries({ queryKey: ["shift-notes", shiftId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete note");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    createNoteMutation.mutate(newNote);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Shift Notes & Communication
          </DialogTitle>
          <DialogDescription>
            Add notes and comments about this shift for team communication.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading notes...</p>
          ) : notes.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground text-center">
                No notes yet. Add the first one below.
              </p>
            </Card>
          ) : (
            notes.map((note: any) => (
              <Card key={note.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {note.author?.display_name || "Unknown"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {format(new Date(note.created_at), "MMM d, h:mm a")}
                      </Badge>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  </div>
                  {isAdmin() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      disabled={deleteNoteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
          <Textarea
            placeholder="Add a note or comment about this shift..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            disabled={createNoteMutation.isPending}
          />
          <Button
            type="submit"
            disabled={!newNote.trim() || createNoteMutation.isPending}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
