import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Note {
  id: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

interface JobCardNotesProps {
  jobCardId: string;
  notes: Note[];
  onRefresh: () => void;
}

const JobCardNotes = ({ jobCardId, notes, onRefresh }: JobCardNotesProps) => {
  const { userName } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const { error } = await supabase.from("job_card_notes").insert({
      job_card_id: jobCardId,
      note: newNote.trim(),
      created_by: userName || "Unknown User"
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Note added successfully",
    });

    setNewNote("");
    setIsAdding(false);
    onRefresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notes</CardTitle>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="space-y-2 p-3 border rounded-lg bg-accent/50">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter your note..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewNote("");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddNote}>
                Save Note
              </Button>
            </div>
          </div>
        )}

        {notes.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-muted-foreground">
            No notes yet. Click "Add Note" to start.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="p-3 border rounded-lg bg-card">
                <p className="text-sm mb-2">{note.note}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{note.created_by || "Unknown"}</span>
                  <span>•</span>
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobCardNotes;