import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCallOutBreakdown, type FleetBreakdown } from "@/hooks/useFleetBreakdowns";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface CallOutFormProps {
    breakdown: FleetBreakdown;
    open: boolean;
    onClose: () => void;
}

export function CallOutForm({ breakdown, open, onClose }: CallOutFormProps) {
    const { userName } = useAuth();
    const callOut = useCallOutBreakdown();

    const [departureTime, setDepartureTime] = useState("");
    const [startTime, setStartTime] = useState("");
    const [completedTime, setCompletedTime] = useState("");
    const [notes, setNotes] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleSubmit = () => {
        setValidationError(null);

        if (!departureTime || !startTime || !completedTime) {
            setValidationError("All three times are required.");
            return;
        }

        const dep = new Date(departureTime);
        const start = new Date(startTime);
        const completed = new Date(completedTime);

        if (dep >= start) {
            setValidationError("Departure time must be before start time.");
            return;
        }
        if (start >= completed) {
            setValidationError("Start time must be before completion time.");
            return;
        }

        callOut.mutate(
            {
                id: breakdown.id,
                departureTime: dep.toISOString(),
                startTime: start.toISOString(),
                completedTime: completed.toISOString(),
                mechanic: userName || "Unknown",
                notes: notes || undefined,
            },
            {
                onSuccess: () => {
                    onClose();
                },
            },
        );
    };

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                <SheetHeader className="mb-4">
                    <SheetTitle>Call Out</SheetTitle>
                    <SheetDescription>
                        Record a call-out for{" "}
                        <strong>{breakdown.vehicle_fleet_number || breakdown.vehicle_registration}</strong>
                        {" — "}
                        {breakdown.description}
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-medium">Mechanic</Label>
                        <Input value={userName || "Unknown"} disabled className="mt-1 bg-muted" />
                    </div>

                    <div>
                        <Label htmlFor="departure" className="text-sm font-medium">
                            Departure Time
                        </Label>
                        <p className="text-xs text-muted-foreground mb-1">
                            When you left the workshop
                        </p>
                        <Input
                            id="departure"
                            type="datetime-local"
                            value={departureTime}
                            onChange={(e) => setDepartureTime(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="start" className="text-sm font-medium">
                            Start Time
                        </Label>
                        <p className="text-xs text-muted-foreground mb-1">
                            When you started working on the vehicle
                        </p>
                        <Input
                            id="start"
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="completed" className="text-sm font-medium">
                            Completion Time
                        </Label>
                        <p className="text-xs text-muted-foreground mb-1">
                            When the repair was finished
                        </p>
                        <Input
                            id="completed"
                            type="datetime-local"
                            value={completedTime}
                            onChange={(e) => setCompletedTime(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="notes" className="text-sm font-medium">
                            Notes (optional)
                        </Label>
                        <Textarea
                            id="notes"
                            placeholder="Describe what was done..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-1"
                            rows={3}
                        />
                    </div>

                    {validationError && (
                        <p className="text-sm text-destructive">{validationError}</p>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleSubmit}
                            disabled={callOut.isPending}
                        >
                            {callOut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                            Complete Call Out
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
