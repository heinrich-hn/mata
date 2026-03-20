import { BreakdownsTable } from "@/components/breakdowns/BreakdownsTable";
import { LogBreakdownDialog } from "@/components/breakdowns/LogBreakdownDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function BreakdownsPage() {
    const [logDialogOpen, setLogDialogOpen] = useState(false);

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-end">
                    <Button
                        onClick={() => setLogDialogOpen(true)}
                        className="bg-destructive hover:bg-destructive/90 gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Log Breakdown
                    </Button>
                </div>

                <BreakdownsTable />
            </div>

            <LogBreakdownDialog
                open={logDialogOpen}
                onOpenChange={setLogDialogOpen}
            />
        </>
    );
}
