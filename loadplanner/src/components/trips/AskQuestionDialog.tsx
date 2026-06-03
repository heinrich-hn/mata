import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateLoad, type Load } from "@/hooks/useTrips";
import {
    getTripQuestions,
    parseTimeWindow,
    stringifyTimeWindow,
    type TripQuestion,
} from "@/lib/timeWindow";
import { format, isValid, parseISO } from "date-fns";
import { CheckCircle2, HelpCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AskQuestionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    load: Load | null;
}

function formatTimestamp(iso: string): string {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "d MMM yyyy, HH:mm") : "";
}

export function AskQuestionDialog({
    open,
    onOpenChange,
    load,
}: AskQuestionDialogProps) {
    const [questionText, setQuestionText] = useState("");
    const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
    const updateLoad = useUpdateLoad();

    const questions = getTripQuestions(load);

    const persistQuestions = (next: TripQuestion[]) => {
        if (!load) return;
        const tw = parseTimeWindow(load.time_window);
        tw.questions = next;
        updateLoad.mutate({ id: load.id, time_window: stringifyTimeWindow(tw) });
    };

    const handleAdd = () => {
        const text = questionText.trim();
        if (!load || !text) return;
        const newQuestion: TripQuestion = {
            id: crypto.randomUUID(),
            text,
            createdAt: new Date().toISOString(),
        };
        // Preserve any already-resolved questions when appending.
        const all = getTripQuestions(load, { includeResolved: true });
        persistQuestions([...all, newQuestion]);
        setQuestionText("");
        toast.success(`Question added to ${load.load_id}`);
    };

    const handleResolve = (id: string) => {
        if (!load) return;
        const answer = (answerDrafts[id] ?? "").trim();
        const all = getTripQuestions(load, { includeResolved: true });
        persistQuestions(
            all.map((q) =>
                q.id === id
                    ? {
                        ...q,
                        resolved: true,
                        resolvedAt: new Date().toISOString(),
                        ...(answer ? { answer } : {}),
                    }
                    : q,
            ),
        );
        setAnswerDrafts((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        toast.success("Question marked as answered");
    };

    const handleDelete = (id: string) => {
        if (!load) return;
        const all = getTripQuestions(load, { includeResolved: true });
        persistQuestions(all.filter((q) => q.id !== id));
        toast.success("Question removed");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-blue-500" />
                        Ask a Question
                    </DialogTitle>
                    <DialogDescription>
                        {load
                            ? `Add a question or query about load ${load.load_id}. Loads with open questions are highlighted in the table.`
                            : "Add a question about this load."}
                    </DialogDescription>
                </DialogHeader>

                {questions.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                            Open questions ({questions.length})
                        </p>
                        <ul className="space-y-2">
                            {questions.map((q) => (
                                <li
                                    key={q.id}
                                    className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/30"
                                >
                                    <div className="flex items-start gap-2">
                                        <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-sm text-foreground">
                                                {q.text}
                                            </p>
                                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                {formatTimestamp(q.createdAt)}
                                            </p>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDelete(q.id)}
                                            disabled={updateLoad.isPending}
                                            aria-label="Remove question"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className="mt-2 flex items-end gap-2 pl-6">
                                        <Textarea
                                            value={answerDrafts[q.id] ?? ""}
                                            onChange={(e) =>
                                                setAnswerDrafts((prev) => ({
                                                    ...prev,
                                                    [q.id]: e.target.value,
                                                }))
                                            }
                                            placeholder="Add the answer (optional)…"
                                            rows={1}
                                            className="min-h-[36px] resize-none bg-background text-xs"
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-9 flex-shrink-0 border-green-400 text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
                                            onClick={() => handleResolve(q.id)}
                                            disabled={updateLoad.isPending}
                                        >
                                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                            Mark Answered
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="space-y-2">
                    <Textarea
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Type your question about this load…"
                        rows={3}
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                e.preventDefault();
                                handleAdd();
                            }
                        }}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button
                        onClick={handleAdd}
                        disabled={!questionText.trim() || updateLoad.isPending}
                    >
                        {updateLoad.isPending ? "Saving…" : "Add Question"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
