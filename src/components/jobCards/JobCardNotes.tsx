import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
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
    requestGoogleSheetsSync('workshop');

    setNewNote("");
    setIsAdding(false);
    onRefresh();
  };

  const handleEditNote = async (noteId: string) => {
    if (!editText.trim()) return;

    const { error } = await supabase
      .from("job_card_notes")
      .update({ note: editText.trim() })
      .eq("id", noteId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Note updated" });
    requestGoogleSheetsSync('workshop');
    setEditingId(null);
    setEditText("");
    onRefresh();
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.note);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
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
              <div key={note.id} className="p-3 border rounded-lg bg-card group">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleEditNote(note.id)} disabled={!editText.trim()}>
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm mb-2 flex-1">{note.note}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => startEdit(note)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{note.created_by || "Unknown"}</span>
                      <span>•</span>
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobCardNotes;