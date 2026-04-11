import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DatePicker } from "../ui/date-picker";

interface CRAReportFormProps {
  workOrderId?: string;
  vehicleId?: string;
  onClose: () => void;
  existingReportId?: string;
}

interface CRAFormData {
  cra_number: string;
  discovery_date: string;
  discovered_by: string;
  issue_category: string;
  issue_description: string;
  root_cause: string;
  contributing_factors: string;
  corrective_actions_taken: string;
  preventive_measures: string;
  risk_assessment: string;
  testing_results: string;
  verification_method: string;
  verification_date: string;
  verified_by: string;
  follow_up_requirements: string;
  status: string;
  vehicle_id: string;
  work_order_id: string | null;
}

const issueCategories = [
  "Mechanical Failure",
  "Electrical Issue",
  "Safety Concern",
  "Operational Error",
  "Maintenance Issue",
  "Parts Defect",
  "Driver Error",
  "Environmental Damage",
  "Wear and Tear",
  "Other"
];

const riskLevels = [
  { value: "low", label: "Low", color: "bg-green-100 text-green-800" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800" }
];

// Status options for future use (e.g., workflow status dropdown)
const _statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" }
];

export default function CRAReportForm({
  workOrderId,
  vehicleId,
  onClose,
  existingReportId
}: CRAReportFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("issue");
  const [contributingFactorsList, setContributingFactorsList] = useState<string[]>([]);
  const [newFactor, setNewFactor] = useState("");
  const [actionsList, setActionsList] = useState<string[]>([]);
  const [newAction, setNewAction] = useState("");

  const [formData, setFormData] = useState<CRAFormData>({
    cra_number: "",
    discovery_date: new Date().toISOString().split('T')[0],
    discovered_by: "",
    issue_category: "",
    issue_description: "",
    root_cause: "",
    contributing_factors: "",
    corrective_actions_taken: "",
    preventive_measures: "",
    risk_assessment: "medium",
    testing_results: "",
    verification_method: "",
    verification_date: "",
    verified_by: "",
    follow_up_requirements: "",
    status: "draft",
    vehicle_id: vehicleId || "",
    work_order_id: workOrderId || null
  });

  // Fetch existing report if editing
  const { data: existingReport, isLoading: isLoadingReport } = useQuery({
    queryKey: ['cra_report', existingReportId],
    queryFn: async () => {
      if (!existingReportId) return null;
      const { data, error } = await supabase
        .from('cra_reports')
        .select('*')
        .eq('id', existingReportId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!existingReportId
  });

  // Fetch vehicles for dropdown
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles_dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, fleet_number, registration_number')
        .eq('active', true)
        .order('fleet_number');
      if (error) throw error;
      return data || [];
    }
  });

  // Generate CRA number
  const generateCRANumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CRA-${year}${month}-${random}`;
  };

  // Populate form when editing
  useEffect(() => {
    if (existingReport) {
      setFormData({
        cra_number: existingReport.cra_number,
        discovery_date: existingReport.discovery_date,
        discovered_by: existingReport.discovered_by,
        issue_category: existingReport.issue_category,
        issue_description: existingReport.issue_description,
        root_cause: existingReport.root_cause,
        contributing_factors: existingReport.contributing_factors || "",
        corrective_actions_taken: existingReport.corrective_actions_taken,
        preventive_measures: existingReport.preventive_measures,
        risk_assessment: existingReport.risk_assessment || "medium",
        testing_results: existingReport.testing_results || "",
        verification_method: existingReport.verification_method || "",
        verification_date: existingReport.verification_date || "",
        verified_by: existingReport.verified_by || "",
        follow_up_requirements: existingReport.follow_up_requirements || "",
        status: existingReport.status,
        vehicle_id: existingReport.vehicle_id,
        work_order_id: existingReport.work_order_id
      });

      // Parse contributing factors list
      if (existingReport.contributing_factors) {
        try {
          const factors = JSON.parse(existingReport.contributing_factors);
          if (Array.isArray(factors)) {
            setContributingFactorsList(factors);
          }
        } catch {
          // If not JSON, treat as single item
          if (existingReport.contributing_factors.trim()) {
            setContributingFactorsList([existingReport.contributing_factors]);
          }
        }
      }
    } else if (!existingReportId) {
      // Generate new CRA number for new reports
      setFormData(prev => ({ ...prev, cra_number: generateCRANumber() }));
    }
  }, [existingReport, existingReportId]);

  // Add contributing factor
  const addContributingFactor = () => {
    if (newFactor.trim()) {
      setContributingFactorsList(prev => [...prev, newFactor.trim()]);
      setNewFactor("");
    }
  };

  // Remove contributing factor
  const removeContributingFactor = (index: number) => {
    setContributingFactorsList(prev => prev.filter((_, i) => i !== index));
  };

  // Add action
  const addAction = () => {
    if (newAction.trim()) {
      setActionsList(prev => [...prev, newAction.trim()]);
      setNewAction("");
    }
  };

  // Remove action
  const removeAction = (index: number) => {
    setActionsList(prev => prev.filter((_, i) => i !== index));
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CRAFormData) => {
      const payload = {
        ...data,
        contributing_factors: contributingFactorsList.length > 0
          ? JSON.stringify(contributingFactorsList)
          : null,
        corrective_actions_taken: actionsList.length > 0
          ? actionsList.join('; ')
          : data.corrective_actions_taken,
        updated_at: new Date().toISOString()
      };

      if (existingReportId) {
        const { error } = await supabase
          .from('cra_reports')
          .update(payload)
          .eq('id', existingReportId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cra_reports')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: existingReportId
          ? "CRA Report updated successfully"
          : "CRA Report created successfully"
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        contributing_factors: contributingFactorsList.length > 0
          ? JSON.stringify(contributingFactorsList)
          : null,
        corrective_actions_taken: actionsList.length > 0
          ? actionsList.join('; ')
          : formData.corrective_actions_taken,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existingReportId) {
        const { error } = await supabase
          .from('cra_reports')
          .update(payload)
          .eq('id', existingReportId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cra_reports')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cra_reports'] });
      toast({
        title: "Success",
        description: "CRA Report submitted for review"
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleInputChange = (field: keyof CRAFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    return (
      formData.cra_number &&
      formData.discovery_date &&
      formData.discovered_by &&
      formData.issue_category &&
      formData.issue_description &&
      formData.root_cause &&
      formData.corrective_actions_taken &&
      formData.preventive_measures &&
      formData.vehicle_id
    );
  };

  if (isLoadingReport) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {existingReportId ? 'Edit CRA Report' : 'New CRA Report'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Corrective and Risk Analysis Report
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {formData.cra_number}
          </Badge>
          <Badge
            variant={formData.status === 'draft' ? 'secondary' : 'default'}
            className="text-sm"
          >
            {formData.status}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="issue" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Issue
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Risk
          </TabsTrigger>
        </TabsList>

        {/* Issue Identification Tab */}
        <TabsContent value="issue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Issue Identification</CardTitle>
              <CardDescription>
                Document the issue details and discovery information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_id">Vehicle *</Label>
                  <Select
                    value={formData.vehicle_id}
                    onValueChange={(v) => handleInputChange('vehicle_id', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          Fleet #{v.fleet_number} - {v.registration_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discovery_date">Discovery Date *</Label>
                  <DatePicker
                    id="discovery_date"
                    value={formData.discovery_date}
                    onChange={(date) => handleInputChange('discovery_date', date ? date.toISOString().split('T')[0] : '')}
                    placeholder="Select discovery date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discovered_by">Discovered By *</Label>
                  <Input
                    id="discovered_by"
                    placeholder="Name of person who discovered the issue"
                    value={formData.discovered_by}
                    onChange={(e) => handleInputChange('discovered_by', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue_category">Issue Category *</Label>
                  <Select
                    value={formData.issue_category}
                    onValueChange={(v) => handleInputChange('issue_category', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="issue_description">Issue Description *</Label>
                <Textarea
                  id="issue_description"
                  placeholder="Provide a detailed description of the issue..."
                  rows={4}
                  value={formData.issue_description}
                  onChange={(e) => handleInputChange('issue_description', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Root Cause Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Root Cause Analysis</CardTitle>
              <CardDescription>
                Identify the root cause and contributing factors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="root_cause">Root Cause *</Label>
                <Textarea
                  id="root_cause"
                  placeholder="Describe the root cause of the issue..."
                  rows={4}
                  value={formData.root_cause}
                  onChange={(e) => handleInputChange('root_cause', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Contributing Factors</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a contributing factor..."
                    value={newFactor}
                    onChange={(e) => setNewFactor(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addContributingFactor())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addContributingFactor}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {contributingFactorsList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contributingFactorsList.map((factor, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {factor}
                        <button
                          type="button"
                          onClick={() => removeContributingFactor(idx)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="testing_results">Testing Results</Label>
                <Textarea
                  id="testing_results"
                  placeholder="Document any testing performed and results..."
                  rows={3}
                  value={formData.testing_results}
                  onChange={(e) => handleInputChange('testing_results', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Corrective Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Corrective Actions</CardTitle>
              <CardDescription>
                Document actions taken and preventive measures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="corrective_actions_taken">Corrective Actions Taken *</Label>
                <Textarea
                  id="corrective_actions_taken"
                  placeholder="Describe the corrective actions taken..."
                  rows={4}
                  value={formData.corrective_actions_taken}
                  onChange={(e) => handleInputChange('corrective_actions_taken', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Action Items</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add an action item..."
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAction())}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAction}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {actionsList.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {actionsList.map((action, idx) => (
                      <li key={idx} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <span className="text-sm">{action}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAction(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="preventive_measures">Preventive Measures *</Label>
                <Textarea
                  id="preventive_measures"
                  placeholder="Describe measures to prevent recurrence..."
                  rows={4}
                  value={formData.preventive_measures}
                  onChange={(e) => handleInputChange('preventive_measures', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow_up_requirements">Follow-up Requirements</Label>
                <Textarea
                  id="follow_up_requirements"
                  placeholder="Any follow-up actions or monitoring required..."
                  rows={3}
                  value={formData.follow_up_requirements}
                  onChange={(e) => handleInputChange('follow_up_requirements', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Assessment Tab */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment & Verification</CardTitle>
              <CardDescription>
                Assess risk level and document verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="risk_assessment">Risk Level</Label>
                <Select
                  value={formData.risk_assessment}
                  onValueChange={(v) => handleInputChange('risk_assessment', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <Badge className={level.color}>{level.label}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="verification_method">Verification Method</Label>
                  <Input
                    id="verification_method"
                    placeholder="How was the fix verified?"
                    value={formData.verification_method}
                    onChange={(e) => handleInputChange('verification_method', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verification_date">Verification Date</Label>
                  <DatePicker
                    id="verification_date"
                    value={formData.verification_date}
                    onChange={(date) => handleInputChange('verification_date', date ? date.toISOString().split('T')[0] : '')}
                    placeholder="Select verification date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verified_by">Verified By</Label>
                <Input
                  id="verified_by"
                  placeholder="Name of person who verified the fix"
                  value={formData.verified_by}
                  onChange={(e) => handleInputChange('verified_by', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate(formData)}
            disabled={!isFormValid() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Draft
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!isFormValid() || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Submit for Review
          </Button>
        </div>
      </div>
    </div>
  );
}
