import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, User } from "lucide-react";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    assignee: string | null;
    priority: string;
    status: string;
    due_date: string | null;
    estimated_hours: number | null;
    actual_hours: number | null;
  };
  onStatusChange: (taskId: string, completed: boolean) => void;
}

const TaskCard = ({ task, onStatusChange }: TaskCardProps) => {
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.status === "completed"}
            onCheckedChange={(checked) => onStatusChange(task.id, checked as boolean)}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </h4>
              <Badge variant={getPriorityVariant(task.priority)} className="shrink-0">
                {task.priority}
              </Badge>
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {task.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{task.assignee}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}
              {(task.estimated_hours || task.actual_hours) && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{task.actual_hours || 0}/{task.estimated_hours || 0}h</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCard;