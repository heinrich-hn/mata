import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TemplateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface JobCardTemplate {
  id?: string;
  name: string;
  description: string;
  default_priority: string;
  default_tasks?: Array<{ title: string; description: string }>;
  default_parts?: Array<{ name: string; quantity: number }>;
}

export const TemplateManagerDialog = ({ open, onOpenChange }: TemplateManagerDialogProps) => {
  const [_editingTemplate, _setEditingTemplate] = useState<JobCardTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_priority: "medium",
    default_tasks: [] as Array<{ title: string; description: string }>,
    default_parts: [] as Array<{ name: string; quantity: number }>,
  });

  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["job_card_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_card_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (templateData: typeof formData) => {
      const { error } = await supabase
        .from("job_card_templates")
        .insert({
          ...templateData,
          default_tasks: templateData.default_tasks.length > 0 ? templateData.default_tasks : null,
          default_parts: templateData.default_parts.length > 0 ? templateData.default_parts : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_card_templates"] });
      toast.success("Template created successfully");
      resetForm();
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_card_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_card_templates"] });
      toast.success("Template deleted successfully");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      default_priority: "medium",
      default_tasks: [],
      default_parts: [],
    });
    _setEditingTemplate(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTemplate.mutate(formData);
  };

  const addTask = () => {
    setFormData({
      ...formData,
      default_tasks: [...formData.default_tasks, { title: "", description: "" }],
    });
  };

  const addPart = () => {
    setFormData({
      ...formData,
      default_parts: [...formData.default_parts, { name: "", quantity: 1 }],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job Card Templates</DialogTitle>
          <DialogDescription>
            Create and manage reusable job card templates
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Template List */}
          <div className="space-y-4">
            <h3 className="font-semibold">Existing Templates</h3>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {template.description}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteTemplate.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {template.default_priority}
                        </Badge>
                        {template.default_tasks && Array.isArray(template.default_tasks) && (
                          <Badge variant="secondary" className="text-xs">
                            {template.default_tasks.length} tasks
                          </Badge>
                        )}
                        {template.default_parts && Array.isArray(template.default_parts) && (
                          <Badge variant="secondary" className="text-xs">
                            {template.default_parts.length} parts
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No templates yet. Create your first template.
              </p>
            )}
          </div>

          {/* Create Template Form */}
          <div className="space-y-4">
            <h3 className="font-semibold">Create New Template</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Routine Maintenance"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Template description"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Default Priority</Label>
                <Select
                  value={formData.default_priority}
                  onValueChange={(value) => setFormData({ ...formData, default_priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Default Tasks</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTask}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Task
                  </Button>
                </div>
                {formData.default_tasks.map((task, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Task title"
                      value={task.title}
                      onChange={(e) => {
                        const newTasks = [...formData.default_tasks];
                        newTasks[index].title = e.target.value;
                        setFormData({ ...formData, default_tasks: newTasks });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newTasks = formData.default_tasks.filter((_, i) => i !== index);
                        setFormData({ ...formData, default_tasks: newTasks });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Default Parts</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPart}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Part
                  </Button>
                </div>
                {formData.default_parts.map((part, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Part name"
                      value={part.name}
                      className="flex-1"
                      onChange={(e) => {
                        const newParts = [...formData.default_parts];
                        newParts[index].name = e.target.value;
                        setFormData({ ...formData, default_parts: newParts });
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={part.quantity}
                      className="w-20"
                      onChange={(e) => {
                        const newParts = [...formData.default_parts];
                        newParts[index].quantity = parseInt(e.target.value);
                        setFormData({ ...formData, default_parts: newParts });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newParts = formData.default_parts.filter((_, i) => i !== index);
                        setFormData({ ...formData, default_parts: newParts });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full" disabled={createTemplate.isPending}>
                {createTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Template
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};