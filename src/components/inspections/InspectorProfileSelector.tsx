import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import
  {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface InspectorProfileSelectorProps {
  value?: string;
  onChange: (inspectorId: string, inspectorName: string) => void;
}

const InspectorProfileSelector = ({
  value,
  onChange,
}: InspectorProfileSelectorProps) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newInspectorName, setNewInspectorName] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const queryClient = useQueryClient();

  // Fetch inspector profiles
  const {
    data: inspectors = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inspector_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspector_profiles")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create new inspector
  const createInspector = useMutation({
    mutationFn: async (data: { name: string; user_id?: string }) => {
      const { data: newInspector, error } = await supabase
        .from("inspector_profiles")
        .insert([
          {
            name: data.name,
            user_id: data.user_id || crypto.randomUUID(), // Generate a user_id if not provided
            phone: null,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;
      return newInspector;
    },
    onSuccess: (newInspector) => {
      queryClient.invalidateQueries({ queryKey: ["inspector_profiles"] });
      toast({
        title: "Success",
        description: `Inspector "${newInspector.name}" created`,
      });
      onChange(newInspector.id, newInspector.name);
      localStorage.setItem("lastInspectorId", newInspector.id);
      setShowQuickAdd(false);
      setNewInspectorName("");
      setNewEmployeeId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create inspector",
        variant: "destructive",
      });
    },
  });

  // Restore last selected inspector
  useEffect(() => {
    if (!value && inspectors.length > 0) {
      const lastId = localStorage.getItem("lastInspectorId");
      const lastInspector = inspectors.find((i) => i.id === lastId);
      if (lastInspector) {
        onChange(lastInspector.id, lastInspector.name);
      } else if (inspectors[0]) {
        // Fallback to first inspector if last one is invalid
        onChange(inspectors[0].id, inspectors[0].name);
        localStorage.setItem("lastInspectorId", inspectors[0].id);
      }
    }
  }, [inspectors, value, onChange]);

  const handleInspectorChange = (inspectorId: string) => {
    const inspector = inspectors.find((i) => i.id === inspectorId);
    if (inspector) {
      onChange(inspectorId, inspector.name);
      localStorage.setItem("lastInspectorId", inspectorId);
    }
  };

  const handleQuickAdd = () => {
    const trimmedName = newInspectorName.trim();
    const trimmedEmployeeId = newEmployeeId.trim();

    if (!trimmedName) {
      toast({
        title: "Error",
        description: "Inspector name is required",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length < 2) {
      toast({
        title: "Error",
        description: "Name must be at least 2 characters",
        variant: "destructive",
      });
      return;
    }

    const isDuplicate = inspectors.some(
      (i) => i.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      toast({
        title: "Error",
        description: "An inspector with this name already exists",
        variant: "destructive",
      });
      return;
    }

    createInspector.mutate({
      name: trimmedName,
      user_id: trimmedEmployeeId || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !createInspector.isPending) {
      handleQuickAdd();
    }
  };

  const inspectorOptions = useMemo(() => {
    return inspectors.map((inspector) => (
      <SelectItem key={inspector.id} value={inspector.id}>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{inspector.name}</span>
          {inspector.email && (
            <span className="text-xs text-muted-foreground">
              {inspector.email}
            </span>
          )}
        </div>
      </SelectItem>
    ));
  }, [inspectors]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading inspectors...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load inspectors. Please refresh.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inspector-select">Inspector</Label>
        <div className="flex gap-2">
          <Select value={value} onValueChange={handleInspectorChange}>
            <SelectTrigger id="inspector-select" className="flex-1">
              <SelectValue placeholder="Select an inspector" />
            </SelectTrigger>
            <SelectContent>
              {inspectorOptions.length > 0 ? (
                inspectorOptions
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No active inspectors
                </div>
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowQuickAdd((prev) => !prev)}
            aria-label="Quick add inspector"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Add Form */}
      {showQuickAdd && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-inspector-name">
                Inspector Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-inspector-name"
                placeholder="e.g. John Doe"
                value={newInspectorName}
                onChange={(e) => setNewInspectorName(e.target.value)}
                onKeyDown={handleKeyPress}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-employee-id">User ID (Optional)</Label>
              <Input
                id="new-employee-id"
                placeholder="Leave blank to auto-generate"
                value={newEmployeeId}
                onChange={(e) => setNewEmployeeId(e.target.value)}
                onKeyDown={handleKeyPress}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleQuickAdd}
                disabled={createInspector.isPending || !newInspectorName.trim()}
                className="flex-1"
              >
                {createInspector.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Inspector
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowQuickAdd(false);
                  setNewInspectorName("");
                  setNewEmployeeId("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InspectorProfileSelector;