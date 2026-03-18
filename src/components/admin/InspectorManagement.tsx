import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus } from "lucide-react";
import { useState } from "react";

type InspectorProfile = Database["public"]["Tables"]["inspector_profiles"]["Row"];

const InspectorManagement = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInspector, setEditingInspector] = useState<InspectorProfile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const queryClient = useQueryClient();

  // Fetch inspectors
  const { data: inspectors, isLoading } = useQuery({
    queryKey: ["inspector_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspector_profiles")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });  // Create inspector
  const createInspector = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("inspector_profiles")
        .insert([{
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          user_id: crypto.randomUUID(), // Generate user_id
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspector_profiles"] });
      toast({ title: "Success", description: "Inspector created" });
      resetForm();
      setShowAddModal(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update inspector
  const updateInspector = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InspectorProfile> }) => {
      const { error } = await supabase
        .from("inspector_profiles")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspector_profiles"] });
      toast({ title: "Success", description: "Inspector updated" });
      resetForm();
      setEditingInspector(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "" });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    if (editingInspector) {
      updateInspector.mutate({ id: editingInspector.id, data: formData });
    } else {
      createInspector.mutate(formData);
    }
  };

  const handleEdit = (inspector: InspectorProfile) => {
    setEditingInspector(inspector);
    setFormData({
      name: inspector.name,
      email: inspector.email || "",
      phone: inspector.phone || "",
    });
    setShowAddModal(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inspector Profiles</CardTitle>
            <CardDescription>Manage inspector accounts for mobile inspections</CardDescription>
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Inspector
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : inspectors && inspectors.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.map((inspector) => (
                <TableRow key={inspector.id}>
                  <TableCell className="font-medium">{inspector.name}</TableCell>
                  <TableCell>{inspector.email || "-"}</TableCell>
                  <TableCell>{inspector.phone || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(inspector)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No inspectors found. Add your first inspector to get started.
          </p>
        )}
      </CardContent>

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingInspector(null);
          resetForm();
        }}
        title={editingInspector ? "Edit Inspector" : "Add Inspector"}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={createInspector.isPending || updateInspector.isPending}
              className="flex-1"
            >
              {editingInspector ? "Update" : "Create"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingInspector(null);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default InspectorManagement;