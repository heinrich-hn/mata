import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserSelect } from "@/components/ui/user-select";
import { useVehicles } from "@/hooks/useVehicles";
import { ChevronDown, Pencil } from "lucide-react";
import { useState } from "react";

interface JobCardGeneralInfoProps {
  jobCard: {
    id: string;
    title: string;
    description: string | null;
    vehicle_id: string | null;
    assignee: string | null;
    priority: string;
  };
  vehicle?: {
    registration_number: string;
    make: string;
    model: string;
    fleet_number?: string | null;
  } | null;
  onUpdate: (updates: Partial<JobCardGeneralInfoProps['jobCard']>) => void;
  defaultCollapsed?: boolean;
}

const JobCardGeneralInfo = ({ jobCard, vehicle, onUpdate, defaultCollapsed = false }: JobCardGeneralInfoProps) => {
  const { data: vehicles = [] } = useVehicles();
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(jobCard.description || "");
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [assignee, setAssignee] = useState(jobCard.assignee || "");
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(jobCard.vehicle_id || "");

  const handleSave = () => {
    onUpdate({ description });
    setIsEditing(false);
  };

  const handleAssigneeSave = () => {
    onUpdate({ assignee });
    setIsEditingAssignee(false);
  };

  const handleVehicleSave = () => {
    onUpdate({ vehicle_id: selectedVehicleId || null });
    setIsEditingVehicle(false);
  };

  return (
    <Collapsible defaultOpen={!defaultCollapsed}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardTitle className="flex items-center gap-2">
              General Information
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Vehicle</Label>
              {isEditingVehicle ? (
                <div className="space-y-2 mt-1">
                  <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <div className="flex items-center gap-2">
                            {v.fleet_number && (
                              <Badge variant="secondary" className="font-mono text-xs">
                                {v.fleet_number}
                              </Badge>
                            )}
                            <span className="font-medium">{v.registration_number}</span>
                            <span className="text-muted-foreground text-sm">
                              {v.make} {v.model}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button onClick={handleVehicleSave} size="sm">
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVehicleId(jobCard.vehicle_id || "");
                        setIsEditingVehicle(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingVehicle(true)}
                  className="mt-1 p-2 border rounded cursor-pointer hover:bg-accent flex items-center justify-between group"
                >
                  {vehicle ? (
                    <div className="flex items-center gap-2">
                      {vehicle.fleet_number && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {vehicle.fleet_number}
                        </Badge>
                      )}
                      <Badge variant="outline">{vehicle.registration_number}</Badge>
                      <span className="text-sm">{vehicle.make} {vehicle.model}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to assign vehicle...</span>
                  )}
                  <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Assignee</Label>
              {isEditingAssignee ? (
                <div className="space-y-2 mt-1">
                  <UserSelect
                    value={assignee}
                    onValueChange={setAssignee}
                    placeholder="Select assignee"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAssigneeSave}
                      size="sm"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAssignee(jobCard.assignee || "");
                        setIsEditingAssignee(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingAssignee(true)}
                  className="mt-1 p-2 text-sm border rounded cursor-pointer hover:bg-accent"
                >
                  {jobCard.assignee || "Click to assign user..."}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              {isEditing ? (
                <div className="space-y-2 mt-1">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter job description..."
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      size="sm"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDescription(jobCard.description || "");
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditing(true)}
                  className="mt-1 p-2 text-sm border rounded cursor-pointer hover:bg-accent min-h-[60px]"
                >
                  {jobCard.description || "Click to add description..."}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default JobCardGeneralInfo;