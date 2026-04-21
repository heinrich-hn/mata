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
import { Edit2, FileDown, Plus, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "inspector";

const renderInspectorOnPdf = (
  doc: jsPDF,
  inspector: InspectorProfile,
  startY: number,
): number => {
  let y = startY;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(inspector.name, 14, y);
  y += 6;

  if (inspector.job_title) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(inspector.job_title, 14, y);
    y += 6;
  }

  doc.setFontSize(10);
  doc.setTextColor(40);
  const contactLines: string[] = [];
  if (inspector.email) contactLines.push(`Email: ${inspector.email}`);
  if (inspector.phone) contactLines.push(`Phone: ${inspector.phone}`);
  if (contactLines.length) {
    doc.text(contactLines.join("    "), 14, y);
    y += 6;
  }

  y += 2;
  autoTable(doc, {
    startY: y,
    head: [["Responsibilities"]],
    body:
      (inspector.responsibilities || []).length > 0
        ? (inspector.responsibilities || []).map((r) => [r])
        : [["—"]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [71, 85, 105] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error - lastAutoTable is added by jspdf-autotable
  y = (doc.lastAutoTable?.finalY ?? y) + 4;

  autoTable(doc, {
    startY: y,
    head: [["Skills"]],
    body:
      (inspector.skills || []).length > 0
        ? (inspector.skills || []).map((s) => [s])
        : [["—"]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error - lastAutoTable is added by jspdf-autotable
  return (doc.lastAutoTable?.finalY ?? y) + 8;
};

const exportInspectorPdf = (inspector: InspectorProfile) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Inspector Profile", 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 24);
  doc.setTextColor(0);

  renderInspectorOnPdf(doc, inspector, 34);
  doc.save(`inspector-${slugify(inspector.name)}.pdf`);
};

const exportAllInspectorsPdf = (inspectors: InspectorProfile[]) => {
  if (inspectors.length === 0) return;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Inspector Profiles", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(
    `${inspectors.length} inspector${inspectors.length === 1 ? "" : "s"} · Generated ${new Date().toLocaleString()}`,
    14,
    24,
  );
  doc.setTextColor(0);

  // Summary table on first page
  autoTable(doc, {
    startY: 30,
    head: [["Name", "Job Title", "Email", "Phone", "# Resp.", "# Skills"]],
    body: inspectors.map((i) => [
      i.name,
      i.job_title || "—",
      i.email || "—",
      i.phone || "—",
      String((i.responsibilities || []).length),
      String((i.skills || []).length),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });

  inspectors.forEach((inspector) => {
    doc.addPage();
    renderInspectorOnPdf(doc, inspector, 18);
  });

  doc.save(`inspector-profiles-${new Date().toISOString().slice(0, 10)}.pdf`);
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportAllInspectorsPdf(inspectors || [])}
              disabled={!inspectors || inspectors.length === 0}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export All PDF
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Inspector
            </Button>
          </div>
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
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => exportInspectorPdf(inspector)}
                        title="Export PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(inspector)}
                        title="Edit inspector"
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
