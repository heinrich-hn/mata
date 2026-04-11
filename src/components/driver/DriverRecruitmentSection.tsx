import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/components/ui/select';
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRecruitment } from '@/hooks/useRecruitment';
import { supabase } from '@/integrations/supabase/client';
import {
generateCandidateListPDF,
generateRecruitmentSummaryPDF,
generateSingleCandidatePDF,
} from '@/lib/recruitmentExport';
import {
CANDIDATE_STATUS_LABELS,
CandidateStatus,
DriverCandidate,
DriverCandidateInsert,
EVALUATION_STEPS,
EvaluationResult,
EvaluationStatus,
EvaluationStep,
} from '@/types/recruitment';
import {
AlertTriangle,
CheckCircle2,
ChevronRight,
ClipboardCheck,
Clock,
Download,
Edit,
ExternalLink,
FileText,
Loader2,
Mail,
MoreVertical,
Phone,
Plus,
Route,
Search,
Trash2,
Truck,
Upload,
User,

Users,
XCircle
} from 'lucide-react';
import { useRef, useState } from 'react';

const INITIAL_FORM_STATE: Partial<DriverCandidateInsert> = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  license_number: '',
  license_class: '',
  license_expiry: '',
  years_experience: 0,
  previous_employer: '',
  address: '',
  city: '',
  application_date: new Date().toISOString().split('T')[0],
  status: 'new',
  current_step: 'interview',
  notes: '',
};

const getStatusColor = (status: CandidateStatus): string => {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'in_progress':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'hired':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'withdrawn':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const _getEvaluationStatusIcon = (status?: EvaluationStatus) => {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'scheduled':
      return <Clock className="w-4 h-4 text-blue-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const DriverRecruitmentSection = () => {
  const {
    candidates,
    isLoading,
    stats,
    createCandidate,
    updateCandidate,
    deleteCandidate,
    updateEvaluation,
    isCreating,
    isUpdating,
    isDeleting,
    getCandidateFullName,
  } = useRecruitment();

  const { toast } = useToast();
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<DriverCandidate | null>(null);
  const [evaluatingCandidate, setEvaluatingCandidate] = useState<DriverCandidate | null>(null);
  const [evaluatingStep, setEvaluatingStep] = useState<EvaluationStep | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<DriverCandidate | null>(null);
  const [formData, setFormData] = useState<Partial<DriverCandidateInsert>>(INITIAL_FORM_STATE);
  const [evaluationData, setEvaluationData] = useState<Partial<EvaluationResult>>({
    status: 'pending',
    notes: '',
    score: undefined,
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isUploadingCv, setIsUploadingCv] = useState(false);

  // Handle CV file selection
  const handleCvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF, PNG, or JPEG file',
          variant: 'destructive',
        });
        return;
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }
      setCvFile(file);
    }
  };

  // Upload CV to Supabase storage
  const uploadCv = async (candidateId: string): Promise<{ path: string; name: string; type: string } | null> => {
    if (!cvFile) return null;

    setIsUploadingCv(true);
    try {
      const fileExt = cvFile.name.split('.').pop();
      const filePath = `${candidateId}/cv_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('candidate-documents')
        .upload(filePath, cvFile);

      if (uploadError) {
        throw uploadError;
      }

      return {
        path: filePath,
        name: cvFile.name,
        type: cvFile.type,
      };
    } catch (error) {
      console.error('Error uploading CV:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload CV. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploadingCv(false);
    }
  };

  // Get CV download URL
  const getCvUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('candidate-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting CV URL:', error);
      return null;
    }
  };

  // Handle viewing CV
  const handleViewCv = async (candidate: DriverCandidate) => {
    if (!candidate.cv_file_path) return;

    const url = await getCvUrl(candidate.cv_file_path);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({
        title: 'Error',
        description: 'Could not retrieve the CV file',
        variant: 'destructive',
      });
    }
  };

  // Filter candidates
  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch =
      searchQuery === '' ||
      getCandidateFullName(candidate).toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.candidate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.license_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.phone?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleInputChange = (field: keyof DriverCandidateInsert, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenCreate = () => {
    setEditingCandidate(null);
    setFormData({
      ...INITIAL_FORM_STATE,
      application_date: new Date().toISOString().split('T')[0],
    });
    setCvFile(null);
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (candidate: DriverCandidate) => {
    setEditingCandidate(candidate);
    setFormData({
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      phone: candidate.phone,
      email: candidate.email || '',
      license_number: candidate.license_number,
      license_class: candidate.license_class,
      license_expiry: candidate.license_expiry,
      years_experience: candidate.years_experience,
      previous_employer: candidate.previous_employer || '',
      address: candidate.address || '',
      city: candidate.city || '',
      application_date: candidate.application_date,
      notes: candidate.notes || '',
    });
    setCvFile(null);
    setIsAddDialogOpen(true);
  };

  const handleOpenEvaluation = (candidate: DriverCandidate, step: EvaluationStep) => {
    setEvaluatingCandidate(candidate);
    setEvaluatingStep(step);

    // Get existing result if any
    let existingResult: EvaluationResult | undefined;
    switch (step) {
      case 'interview':
        existingResult = candidate.interview_result;
        break;
      case 'yard_test':
        existingResult = candidate.yard_test_result;
        break;
      case 'road_test':
        existingResult = candidate.road_test_result;
        break;
    }

    setEvaluationData({
      status: existingResult?.status || 'pending',
      scheduled_date: existingResult?.scheduled_date || '',
      completed_date: existingResult?.completed_date || '',
      evaluator_name: existingResult?.evaluator_name || '',
      score: existingResult?.score,
      notes: existingResult?.notes || '',
      feedback: existingResult?.feedback || '',
    });

    setIsEvaluationDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.phone || !formData.license_number) {
      return;
    }

    if (editingCandidate) {
      // Handle CV upload for existing candidate
      if (cvFile) {
        const cvData = await uploadCv(editingCandidate.id);
        if (cvData) {
          updateCandidate(editingCandidate.id, {
            ...formData,
            cv_file_path: cvData.path,
            cv_file_name: cvData.name,
            cv_file_type: cvData.type,
            cv_uploaded_at: new Date().toISOString(),
          });
        } else {
          updateCandidate(editingCandidate.id, formData);
        }
      } else {
        updateCandidate(editingCandidate.id, formData);
      }
    } else {
      // For new candidates, we need to create first then upload CV
      // The CV will be uploaded separately after creation if needed
      createCandidate(formData as DriverCandidateInsert);
      // Note: CV upload for new candidates would need to be handled after creation
      // This is a simplified version - in production, you'd want to handle this better
    }

    setIsAddDialogOpen(false);
    setFormData(INITIAL_FORM_STATE);
    setCvFile(null);
  };

  const handleSubmitEvaluation = () => {
    if (!evaluatingCandidate || !evaluatingStep) return;

    const result: EvaluationResult = {
      step: evaluatingStep,
      status: evaluationData.status as EvaluationStatus,
      scheduled_date: evaluationData.scheduled_date,
      completed_date: evaluationData.completed_date,
      evaluator_name: evaluationData.evaluator_name,
      score: evaluationData.score,
      notes: evaluationData.notes,
      feedback: evaluationData.feedback,
    };

    updateEvaluation(evaluatingCandidate.id, evaluatingStep, result);
    setIsEvaluationDialogOpen(false);
    setEvaluatingCandidate(null);
    setEvaluatingStep(null);
  };

  const handleDelete = () => {
    if (deletingCandidate) {
      deleteCandidate(deletingCandidate.id);
      setIsDeleteDialogOpen(false);
      setDeletingCandidate(null);
    }
  };

  const getStepInfo = (step: EvaluationStep) => {
    return EVALUATION_STEPS.find((s) => s.value === step);
  };

  const _getCurrentStepResult = (candidate: DriverCandidate): EvaluationResult | undefined => {
    switch (candidate.current_step) {
      case 'interview':
        return candidate.interview_result;
      case 'yard_test':
        return candidate.yard_test_result;
      case 'road_test':
        return candidate.road_test_result;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recruitment Pipeline Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recruitment Pipeline</CardTitle>
          <CardDescription>Three-step evaluation process for driver candidates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {EVALUATION_STEPS.map((step, index) => (
              <div key={step.value} className="flex-1">
                <div className="flex items-center">
                  <div
                    className={`flex-1 flex flex-col items-center p-4 rounded-lg border-2 ${index === 0
                        ? 'border-purple-300 bg-purple-50'
                        : index === 1
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-orange-300 bg-orange-50'
                      }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${index === 0
                          ? 'bg-purple-200 text-purple-700'
                          : index === 1
                            ? 'bg-amber-200 text-amber-700'
                            : 'bg-orange-200 text-orange-700'
                        }`}
                    >
                      {index === 0 ? (
                        <ClipboardCheck className="w-5 h-5" />
                      ) : index === 1 ? (
                        <Truck className="w-5 h-5" />
                      ) : (
                        <Route className="w-5 h-5" />
                      )}
                    </div>
                    <p className="font-medium text-sm text-center">{step.label}</p>
                    <p className="text-xs text-gray-500 text-center mt-1">{step.description}</p>
                    <Badge variant="secondary" className="mt-2">
                      {step.value === 'interview'
                        ? stats.atInterview
                        : step.value === 'yard_test'
                          ? stats.atYardTest
                          : stats.atRoadTest}{' '}
                      candidates
                    </Badge>
                  </div>
                  {index < EVALUATION_STEPS.length - 1 && (
                    <ChevronRight className="w-6 h-6 text-gray-400 mx-2 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Candidates List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Driver Candidates</CardTitle>
              <CardDescription>
                Manage potential drivers through the recruitment process
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export PDF
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      generateCandidateListPDF(filteredCandidates, {
                        status: statusFilter,
                        searchQuery: searchQuery,
                      })
                    }
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export Candidate List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generateRecruitmentSummaryPDF(candidates)}>
                    <Users className="w-4 h-4 mr-2" />
                    Export Summary Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Candidate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, candidate number, license, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Candidate</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Current Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      {searchQuery || statusFilter !== 'all'
                        ? 'No candidates match your filters'
                        : 'No candidates yet. Add your first candidate to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <TableRow key={candidate.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{getCandidateFullName(candidate)}</p>
                            <p className="text-xs text-gray-500">{candidate.candidate_number}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {candidate.phone}
                          </div>
                          {candidate.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Mail className="w-3 h-3 text-gray-400" />
                              {candidate.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{candidate.license_number}</p>
                          <p className="text-xs text-gray-500">Class: {candidate.license_class}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{candidate.years_experience} years</p>
                        {candidate.previous_employer && (
                          <p className="text-xs text-gray-500">{candidate.previous_employer}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Step Progress Indicator */}
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${candidate.interview_result?.status === 'passed'
                                  ? 'bg-green-100 text-green-700'
                                  : candidate.interview_result?.status === 'failed'
                                    ? 'bg-red-100 text-red-700'
                                    : candidate.current_step === 'interview'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                              1
                            </div>
                            <div className="w-4 h-0.5 bg-gray-200" />
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${candidate.yard_test_result?.status === 'passed'
                                  ? 'bg-green-100 text-green-700'
                                  : candidate.yard_test_result?.status === 'failed'
                                    ? 'bg-red-100 text-red-700'
                                    : candidate.current_step === 'yard_test'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                              2
                            </div>
                            <div className="w-4 h-0.5 bg-gray-200" />
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${candidate.road_test_result?.status === 'passed'
                                  ? 'bg-green-100 text-green-700'
                                  : candidate.road_test_result?.status === 'failed'
                                    ? 'bg-red-100 text-red-700'
                                    : candidate.current_step === 'road_test'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-gray-100 text-gray-400'
                                }`}
                            >
                              3
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {getStepInfo(candidate.current_step)?.label}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(candidate.status)}>
                          {CANDIDATE_STATUS_LABELS[candidate.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(candidate)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            {candidate.cv_file_path && (
                              <DropdownMenuItem onClick={() => handleViewCv(candidate)}>
                                <FileText className="w-4 h-4 mr-2" />
                                View CV
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => generateSingleCandidatePDF(candidate)}>
                              <Download className="w-4 h-4 mr-2" />
                              Export Profile PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleOpenEvaluation(candidate, 'interview')}
                              disabled={
                                candidate.status === 'hired' || candidate.status === 'rejected'
                              }
                            >
                              <ClipboardCheck className="w-4 h-4 mr-2" />
                              Interview Evaluation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEvaluation(candidate, 'yard_test')}
                              disabled={
                                candidate.interview_result?.status !== 'passed' ||
                                candidate.status === 'hired' ||
                                candidate.status === 'rejected'
                              }
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              Yard Test Evaluation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEvaluation(candidate, 'road_test')}
                              disabled={
                                candidate.yard_test_result?.status !== 'passed' ||
                                candidate.status === 'hired' ||
                                candidate.status === 'rejected'
                              }
                            >
                              <Route className="w-4 h-4 mr-2" />
                              Road Test Evaluation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setDeletingCandidate(candidate);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove Candidate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Candidate Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}
            </DialogTitle>
            <DialogDescription>
              {editingCandidate
                ? 'Update the candidate information'
                : 'Enter the details of the potential driver candidate'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name || ''}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name || ''}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                placeholder="Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+27 82 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number *</Label>
              <Input
                id="license_number"
                value={formData.license_number || ''}
                onChange={(e) => handleInputChange('license_number', e.target.value)}
                placeholder="ABC123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_class">License Class *</Label>
              <Select
                value={formData.license_class || ''}
                onValueChange={(value) => handleInputChange('license_class', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EC">EC (Extra Heavy)</SelectItem>
                  <SelectItem value="C1">C1 (Heavy)</SelectItem>
                  <SelectItem value="C">C (Heavy)</SelectItem>
                  <SelectItem value="EB">EB (Medium)</SelectItem>
                  <SelectItem value="B">B (Light)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_expiry">License Expiry Date *</Label>
              <DatePicker
                id="license_expiry"
                value={formData.license_expiry || undefined}
                onChange={(date) => handleInputChange('license_expiry', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select expiry date"
                minDate={new Date()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="years_experience">Years of Experience</Label>
              <Input
                id="years_experience"
                type="number"
                min="0"
                value={formData.years_experience || 0}
                onChange={(e) => handleInputChange('years_experience', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="previous_employer">Previous Employer</Label>
              <Input
                id="previous_employer"
                value={formData.previous_employer || ''}
                onChange={(e) => handleInputChange('previous_employer', e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application_date">Application Date</Label>
              <DatePicker
                id="application_date"
                value={formData.application_date || undefined}
                onChange={(date) => handleInputChange('application_date', date ? date.toISOString().split('T')[0] : '')}
                placeholder="Select application date"
                maxDate={new Date()}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes about the candidate..."
                rows={3}
              />
            </div>

            {/* CV Upload Section */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="cv_upload">CV / Resume</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  ref={cvInputRef}
                  id="cv_upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleCvFileChange}
                  className="hidden"
                />
                {cvFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">{cvFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCvFile(null)}
                    >
                      <XCircle className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : editingCandidate?.cv_file_name ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">{editingCandidate.cv_file_name}</p>
                        <p className="text-xs text-green-600">Currently uploaded</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCv(editingCandidate)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cvInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Replace
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => cvInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center py-4 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">Click to upload CV</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, PNG, or JPEG (max 10MB)</p>
                  </button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating || isUploadingCv}>
              {(isCreating || isUpdating || isUploadingCv) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isUploadingCv ? 'Uploading CV...' : editingCandidate ? 'Update Candidate' : 'Add Candidate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Dialog */}
      <Dialog open={isEvaluationDialogOpen} onOpenChange={setIsEvaluationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {evaluatingStep && getStepInfo(evaluatingStep)?.label} Evaluation
            </DialogTitle>
            <DialogDescription>
              {evaluatingCandidate && (
                <>
                  Candidate: {getCandidateFullName(evaluatingCandidate)} (
                  {evaluatingCandidate.candidate_number})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {evaluatingStep && getStepInfo(evaluatingStep)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Evaluation Result *</Label>
              <Select
                value={evaluationData.status || 'pending'}
                onValueChange={(value) =>
                  setEvaluationData((prev) => ({ ...prev, status: value as EvaluationStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scheduled Date</Label>
                <DatePicker
                  value={evaluationData.scheduled_date || undefined}
                  onChange={(date) =>
                    setEvaluationData((prev) => ({ ...prev, scheduled_date: date ? date.toISOString().split('T')[0] : '' }))
                  }
                  placeholder="Select scheduled date"
                />
              </div>
              <div className="space-y-2">
                <Label>Completed Date</Label>
                <DatePicker
                  value={evaluationData.completed_date || undefined}
                  onChange={(date) =>
                    setEvaluationData((prev) => ({ ...prev, completed_date: date ? date.toISOString().split('T')[0] : '' }))
                  }
                  placeholder="Select completed date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Evaluator Name</Label>
              <Input
                value={evaluationData.evaluator_name || ''}
                onChange={(e) =>
                  setEvaluationData((prev) => ({ ...prev, evaluator_name: e.target.value }))
                }
                placeholder="Name of the person conducting the evaluation"
              />
            </div>

            <div className="space-y-2">
              <Label>Score (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={evaluationData.score || ''}
                onChange={(e) =>
                  setEvaluationData((prev) => ({
                    ...prev,
                    score: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                placeholder="Optional score"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={evaluationData.notes || ''}
                onChange={(e) =>
                  setEvaluationData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Observations during the evaluation..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Feedback for Candidate</Label>
              <Textarea
                value={evaluationData.feedback || ''}
                onChange={(e) =>
                  setEvaluationData((prev) => ({ ...prev, feedback: e.target.value }))
                }
                placeholder="Feedback to share with the candidate..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvaluationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEvaluation} disabled={isUpdating}>
              {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Remove Candidate
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{deletingCandidate && getCandidateFullName(deletingCandidate)}</strong> from
              the recruitment pipeline? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverRecruitmentSection;
