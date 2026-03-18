import { Button } from "@/components/ui/button";
import
  {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
import
  {
    AlertTriangle,
    Archive,
    ClipboardList,
    Eye,
    FileText,
    Share2,
    Trash2,
    Wrench,
  } from "lucide-react";

interface InspectionActionsMenuProps {
  inspectionId: string;
  inspectionNumber: string;
  onView: () => void;
  onShare: () => void;
  onCreateWorkOrder: () => void;
  onCorrectiveAction: () => void;
  onRootCauseAnalysis: () => void;
  onViewPDF: () => void;
  onArchive: () => void;
  onDelete: () => void;
  hasFaultsNeedingAction?: boolean; // New prop
}

export function InspectionActionsMenu({
  inspectionId: _inspectionId,
  inspectionNumber: _inspectionNumber,
  onView,
  onShare,
  onCreateWorkOrder,
  onCorrectiveAction,
  onRootCauseAnalysis,
  onViewPDF,
  onArchive,
  onDelete,
  hasFaultsNeedingAction = false, // Default to false
}: InspectionActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm">
          Action
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" />
          View
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onCreateWorkOrder}>
          <Wrench className="h-4 w-4 mr-2" />
          Create Job Card
        </DropdownMenuItem>

        {/* FIXED: Disable Corrective Action when no faults need attention */}
        <DropdownMenuItem 
          onClick={onCorrectiveAction}
          disabled={!hasFaultsNeedingAction}
          className={!hasFaultsNeedingAction ? "opacity-50 cursor-not-allowed" : ""}
        >
          <ClipboardList className="h-4 w-4 mr-2" />
          <span>Corrective Action</span>
          {!hasFaultsNeedingAction && (
            <span className="ml-auto text-xs text-muted-foreground">
              No faults
            </span>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onRootCauseAnalysis}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          Root Cause Analysis
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onViewPDF}>
          <FileText className="h-4 w-4 mr-2" />
          View PDF
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onArchive}>
          <Archive className="h-4 w-4 mr-2" />
          Archive
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}