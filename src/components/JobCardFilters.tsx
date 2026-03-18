import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface JobCardFiltersProps {
  onFilterChange: (filters: {
    search: string;
    status: string;
    priority: string;
    assignee: string;
  }) => void;
  assignees: string[];
}

const JobCardFilters = ({ onFilterChange, assignees }: JobCardFiltersProps) => {
  const handleChange = (key: keyof Parameters<typeof onFilterChange>[0], value: string) => {
    const defaultFilters = {
      search: "",
      status: "all",
      priority: "all",
      assignee: "all",
    };

    onFilterChange({
      ...defaultFilters,
      [key]: value
    });
  };

  return (
    <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card border rounded-lg">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search job cards..."
            onChange={(e) => handleChange("search", e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Select defaultValue="all" onValueChange={(value) => handleChange("status", value)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all" onValueChange={(value) => handleChange("priority", value)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>

      {assignees.length > 0 && (
        <Select defaultValue="all" onValueChange={(value) => handleChange("assignee", value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {assignees.map((assignee) => (
              <SelectItem key={assignee} value={assignee}>
                {assignee}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default JobCardFilters;