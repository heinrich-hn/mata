import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Modal from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

type InspectorProfile = Database["public"]["Tables"]["inspector_profiles"]["Row"] & {
  job_title?: string | null;
  responsibilities?: string[] | null;
  skills?: string[] | null;
};

interface FormState {
  name: string;
  email: string;
  phone: string;
  job_title: string;
  responsibilities: string[];
  skills: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  job_title: "",
  responsibilities: [],
  skills: [],
};

const InspectorManagement = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInspector, setEditingInspector] = useState<InspectorProfile | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [respDraft, setRespDraft] = useState("");
  const [skillDraft, setSkillDraft] = useState("");
  const queryClient = useQueryClient();

  const { data: inspectors, isLoading } = useQuery({
    queryKey: ["inspector_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspector_profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as InspectorProfile[];
    },
  });

  const createInspector = useMutation({
    mutationFn: async (data: FormState) => {
      const { error } = await supabase.from("inspector_profiles").insert([{
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        job_title: data.job_title || null,
        responsibilities: data.responsibilities,
        skills: data.skills,
        user_id: crypto.randomUUID(),
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspector_profiles"] });
      toast({ title: "Success", description: "Inspector created" });
      closeModal();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateInspector = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormState }) => {
      const { error } = await supabase
        .from("inspector_profiles")
        .update({
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          job_title: data.job_title || null,
          responsibilities: data.responsibilities,
          skills: data.skills,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspector_profiles"] });
      toast({ title: "Success", description: "Inspector updated" });
      closeModal();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const closeModal = () => {
    setShowAddModal(false);
    setEditingInspector(null);
    setFormData(EMPTY_FORM);
    setRespDraft("");
    setSkillDraft("");
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    const payload: FormState = {
      ...formData,
      responsibilities: respDraft.trim()
        ? Array.from(new Set([...formData.responsibilities, respDraft.trim()]))
        : formData.responsibilities,
      skills: skillDraft.trim()
        ? Array.from(new Set([...formData.skills, skillDraft.trim()]))
        : formData.skills,
    };

    if (editingInspector) {
      updateInspector.mutate({ id: editingInspector.id, data: payload });
    } else {
      createInspector.mutate(payload);
    }
  };

  const handleEdit = (inspector: InspectorProfile) => {
    setEditingInspector(inspector);
    setFormData({
      name: inspector.name,
      email: inspector.email || "",
      phone: inspector.phone || "",
      job_title: inspector.job_title || "",
      responsibilities: inspector.responsibilities || [],
      skills: inspector.skills || [],
    });
    setRespDraft("");
    setSkillDraft("");
    setShowAddModal(true);
  };

  const addChip = (kind: "responsibilities" | "skills", value: string) => {
    const v = value.trim();
    if (!v) return;
    setFormData((prev) => {
      if (prev[kind].includes(v)) return prev;
      return { ...prev, [kind]: [...prev[kind], v] };
    });
    if (kind === "responsibilities") setRespDraft("");
    else setSkillDraft("");
  };

  const removeChip = (kind: "responsibilities" | "skills", idx: number) => {
    setFormData((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== idx),
    }));
  };

  const handleChipKey = (
    e: KeyboardEvent<HTMLInputElement>,
    kind: "responsibilities" | "skills",
    value: string,
  ) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(kind, value);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inspector Profiles</CardTitle>
            <CardDescription>
              Manage inspectors, their job titles, responsibilities, and skills.
            </CardDescription>
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
                <TableHead>Job Title</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Responsibilities</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.map((inspector) => (
                <TableRow key={inspector.id}>
                  <TableCell className="font-medium">{inspector.name}</TableCell>
                  <TableCell className="text-sm">
                    {inspector.job_title || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{inspector.email || "—"}</div>
                    <div>{inspector.phone || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {(inspector.responsibilities || []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        (inspector.responsibilities || []).map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {(inspector.skills || []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        (inspector.skills || []).map((s, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] border-blue-300 text-blue-700"
                          >
                            {s}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(inspector)}
                      title="Edit inspector"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
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
        onClose={closeModal}
        title={editingInspector ? "Edit Inspector" : "Add Inspector"}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="e.g. Senior Workshop Inspector"
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
          </div>

          <div className="space-y-2">
            <Label>Responsibilities</Label>
            <div className="flex gap-2">
              <Input
                value={respDraft}
                onChange={(e) => setRespDraft(e.target.value)}
                onKeyDown={(e) => handleChipKey(e, "responsibilities", respDraft)}
                placeholder="Type and press Enter (e.g. Pre-trip inspections)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addChip("responsibilities", respDraft)}
              >
                Add
              </Button>
            </div>
            {formData.responsibilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {formData.responsibilities.map((r, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {r}
                    <button
                      type="button"
                      onClick={() => removeChip("responsibilities", i)}
                      className="ml-1 hover:text-destructive"
                      aria-label={`Remove ${r}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => handleChipKey(e, "skills", skillDraft)}
                placeholder="Type and press Enter (e.g. Diesel mechanic, Brake systems)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addChip("skills", skillDraft)}
              >
                Add
              </Button>
            </div>
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {formData.skills.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="gap-1 border-blue-300 text-blue-700"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeChip("skills", i)}
                      className="ml-1 hover:text-destructive"
                      aria-label={`Remove ${s}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={createInspector.isPending || updateInspector.isPending}
              className="flex-1"
            >
              {editingInspector ? "Update" : "Create"}
            </Button>
            <Button variant="outline" onClick={closeModal} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default InspectorManagement;
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