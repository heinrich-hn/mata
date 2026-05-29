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

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-none capitalize";

const JobCardHeader = ({ jobCard, onClose, onStatusChange, onPriorityChange: _onPriorityChange }: JobCardHeaderProps) => {
  const renderPriorityPill = (priority: string) => {
    const styles: Record<string, { wrap: string; dot: string }> = {
      urgent: { wrap: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500 animate-pulse" },
      high: { wrap: "border-orange-200 bg-orange-50 text-orange-700", dot: "bg-orange-500" },
      medium: { wrap: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
      low: { wrap: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
    };
    const s = styles[priority] ?? styles.low;
    return (
      <span className={`${PILL_BASE} ${s.wrap}`}>
        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
        {priority}
      </span>
    );
  };

  const renderStatusPill = (status: string) => {
    const styles: Record<string, { wrap: string; dot: string }> = {
      completed: { wrap: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
      in_progress: { wrap: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
      on_hold: { wrap: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
      pending: { wrap: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" },
    };
    const s = styles[status] ?? styles.pending;
    return (
      <span className={`${PILL_BASE} ${s.wrap}`}>
        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="pb-4 border-b space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-muted-foreground">
              #{jobCard.job_number}
            </span>
            {renderPriorityPill(jobCard.priority)}
            {renderStatusPill(jobCard.status)}
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3 break-words">{jobCard.title}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {jobCard.assignee && (
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 shrink-0" />
                <span>{jobCard.assignee}</span>
              </div>
            )}
            {jobCard.due_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Due {new Date(jobCard.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Created {new Date(jobCard.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={jobCard.status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JobCardHeader;