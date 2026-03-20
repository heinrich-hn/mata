import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { requestGoogleSheetsSync } from "@/hooks/useGoogleSheetsSync";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquarePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

interface JobCardNotesPopoverProps {
    jobCardId: string;
    jobNumber: string;
    notesCount: number;
}

interface Note {
    id: string;
    note: string;
    created_by: string | null;
    created_at: string;
}

const JobCardNotesPopover = ({ jobCardId, jobNumber, notesCount }: JobCardNotesPopoverProps) => {
    const { userName } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");

    const { data: notes = [], isLoading } = useQuery<Note[]>({
        queryKey: ["job_card_notes_popover", jobCardId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("job_card_notes")
                .select("id, note, created_by, created_at")
                .eq("job_card_id", jobCardId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []) as Note[];
        },
        enabled: open,
    });

    const handleAddNote = async () => {
        if (!newNote.trim()) return;

        const { error } = await supabase.from("job_card_notes").insert({
            job_card_id: jobCardId,
            note: newNote.trim(),
            created_by: userName || "Unknown User",
        });

        if (error) {
            toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
            return;
        }

        toast({ title: "Note added", description: `Note saved for job #${jobNumber}` });
        requestGoogleSheetsSync("workshop");
        setNewNote("");
        setIsAdding(false);
        queryClient.invalidateQueries({ queryKey: ["job_card_notes_popover", jobCardId] });
        queryClient.invalidateQueries({ queryKey: ["job_cards_with_vehicles"] });
    };

    const handleEditNote = async (noteId: string) => {
        if (!editText.trim()) return;

        const { error } = await supabase
            .from("job_card_notes")
            .update({ note: editText.trim() })
            .eq("id", noteId);

        if (error) {
            toast({ title: "Error", description: "Failed to update note", variant: "destructive" });
            return;
        }

        toast({ title: "Note updated" });
        requestGoogleSheetsSync("workshop");
        setEditingId(null);
        setEditText("");
        queryClient.invalidateQueries({ queryKey: ["job_card_notes_popover", jobCardId] });
    };

    const handleDeleteNote = async (noteId: string) => {
        const { error } = await supabase
            .from("job_card_notes")
            .delete()
            .eq("id", noteId);

        if (error) {
            toast({ title: "Error", description: "Failed to delete note", variant: "destructive" });
            return;
        }

        toast({ title: "Note deleted" });
        requestGoogleSheetsSync("workshop");
        queryClient.invalidateQueries({ queryKey: ["job_card_notes_popover", jobCardId] });
        queryClient.invalidateQueries({ queryKey: ["job_cards_with_vehicles"] });
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
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex"
                >
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors">
                        <MessageSquarePlus className="h-3 w-3 mr-1" />
                        {notesCount} Note{notesCount > 1 ? "s" : ""}
                    </Badge>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0"
                align="start"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-3 border-b flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Notes — #{jobNumber}</h4>
                    {!isAdding && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsAdding(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                    )}
                </div>

                <ScrollArea className="max-h-[300px]">
                    <div className="p-3 space-y-2">
                        {isAdding && (
                            <div className="space-y-2 p-2 border rounded-lg bg-accent/50">
                                <Textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Enter note..."
                                    rows={2}
                                    className="text-sm"
                                />
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="sm" className="h-7" onClick={() => { setIsAdding(false); setNewNote(""); }}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" className="h-7" onClick={handleAddNote} disabled={!newNote.trim()}>
                                        Save
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isLoading ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                        ) : notes.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>
                        ) : (
                            notes.map((note) => (
                                <div key={note.id} className="p-2 border rounded-lg bg-card text-sm group">
                                    {editingId === note.id ? (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                rows={2}
                                                className="text-sm"
                                            />
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={cancelEdit}>
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="sm" className="h-6 w-6 p-0" onClick={() => handleEditNote(note.id)} disabled={!editText.trim()}>
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-1">
                                                <p className="text-sm leading-snug flex-1">{note.note}</p>
                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => startEdit(note)}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteNote(note.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                                                <span>{note.created_by || "Unknown"}</span>
                                                <span>·</span>
                                                <span>{new Date(note.created_at).toLocaleString()}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export default JobCardNotesPopover;
