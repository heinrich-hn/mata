import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
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
  defaultCollapsed?: boolean;
}

const JobCardNotes = ({ jobCardId, notes, onRefresh, defaultCollapsed = false }: JobCardNotesProps) => {
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

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from("job_card_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Note deleted" });
    requestGoogleSheetsSync('workshop');
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
    <Collapsible defaultOpen={!defaultCollapsed}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors">
            <CardTitle className="flex items-center gap-2">
              Notes
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
            </CardTitle>
            {!isAdding && (
              <Button onClick={(e) => { e.stopPropagation(); setIsAdding(true); }} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
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
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => startEdit(note)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default JobCardNotes;