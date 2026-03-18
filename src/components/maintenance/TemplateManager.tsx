import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Copy, Edit, FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  default_priority: string | null;
  default_tasks: unknown;
  default_parts: unknown;
  created_at: string;
}

export function TemplateManager() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_priority: 'medium',
  });
  const { toast } = useToast();

  const { data: templates, refetch } = useQuery({
    queryKey: ["maintenance-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_card_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Template[];
    },
  });

  const handleCreate = async () => {
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Template name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from('job_card_templates').insert({
        name: formData.name,
        description: formData.description,
        default_priority: formData.default_priority,
        default_tasks: [],
        default_parts: [],
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template created successfully",
      });

      setShowCreateDialog(false);
      setFormData({ name: '', description: '', default_priority: 'medium' });
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('job_card_templates')
        .update({
          name: formData.name,
          description: formData.description,
          default_priority: formData.default_priority,
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template updated successfully",
      });

      setEditingTemplate(null);
      setFormData({ name: '', description: '', default_priority: 'medium' });
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('job_card_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
      });

      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleClone = async (template: Template) => {
    try {
      const { error } = await supabase.from('job_card_templates').insert([{
        name: `${template.name} (Copy)`,
        description: template.description,
        default_priority: template.default_priority,
        default_tasks: template.default_tasks as never,
        default_parts: template.default_parts as never,
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template cloned successfully",
      });

      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      default_priority: template.default_priority || 'medium',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Maintenance Templates</h2>
          <p className="text-muted-foreground">Create reusable templates for common maintenance tasks</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates?.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleClone(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-2">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Priority:</span>
                    <Badge variant="outline" className="capitalize">
                      {template.default_priority}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Default Tasks:</span>
                    <span>{Array.isArray(template.default_tasks) ? template.default_tasks.length : 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Default Parts:</span>
                    <span>{Array.isArray(template.default_parts) ? template.default_parts.length : 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {templates?.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No templates yet</p>
                <p className="text-sm text-muted-foreground/80 mt-1">
                  Create your first template to get started
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingTemplate} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingTemplate(null);
          setFormData({ name: '', description: '', default_priority: 'medium' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name*</Label>
              <Input
                id="name"
                placeholder="e.g., Monthly Oil Change"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe this maintenance template..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
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
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingTemplate(null);
                setFormData({ name: '', description: '', default_priority: 'medium' });
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingTemplate ? handleUpdate : handleCreate}>
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
