import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, User, X } from "lucide-react";

interface JobCardHeaderProps {
  jobCard: {
    id: string;
    job_number: string;
    title: string;
    status: string;
    priority: string;
    assignee: string | null;
    due_date: string | null;
    created_at: string;
  };
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
}

const JobCardHeader = ({ jobCard, onClose, onStatusChange, onPriorityChange: _onPriorityChange }: JobCardHeaderProps) => {
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "default";
      case "pending": return "secondary";
      case "on_hold": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="pb-4 border-b space-y-3 w-full">
      {/* Top row: job number, priority/status badges, close button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground font-mono">#{jobCard.job_number}</span>
          <Badge variant={getPriorityVariant(jobCard.priority)}>
            {jobCard.priority}
          </Badge>
          <Badge variant={getStatusVariant(jobCard.status)}>
            {jobCard.status.replace('_', ' ')}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-semibold leading-tight">{jobCard.title}</h2>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {jobCard.assignee && (
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{jobCard.assignee}</span>
          </div>
        )}
        {jobCard.due_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{new Date(jobCard.due_date).toLocaleDateString()}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>Created {new Date(jobCard.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Status select — full width on mobile, auto on larger screens */}
      <Select value={jobCard.status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default JobCardHeader;