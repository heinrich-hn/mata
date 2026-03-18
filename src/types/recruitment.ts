// HR Driver Recruitment Types

export type EvaluationStep = 'interview' | 'yard_test' | 'road_test';
export type EvaluationStatus = 'pending' | 'passed' | 'failed' | 'scheduled';
export type CandidateStatus = 'new' | 'in_progress' | 'hired' | 'rejected' | 'withdrawn';

export interface EvaluationResult {
  step: EvaluationStep;
  status: EvaluationStatus;
  scheduled_date?: string;
  completed_date?: string;
  evaluator_name?: string;
  score?: number;
  notes?: string;
  feedback?: string;
}

export interface DriverCandidate {
  id: string;
  candidate_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  license_number: string;
  license_class: string;
  license_expiry: string;
  years_experience: number;
  previous_employer?: string;
  address?: string;
  city?: string;
  application_date: string;
  status: CandidateStatus;
  current_step: EvaluationStep;
  interview_result?: EvaluationResult;
  yard_test_result?: EvaluationResult;
  road_test_result?: EvaluationResult;
  cv_file_path?: string;
  cv_file_name?: string;
  cv_file_type?: string;
  cv_uploaded_at?: string;
  notes?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export type DriverCandidateInsert = Omit<DriverCandidate, 'id' | 'created_at' | 'updated_at' | 'candidate_number'>;
export type DriverCandidateUpdate = Partial<DriverCandidateInsert>;

export const EVALUATION_STEPS: { value: EvaluationStep; label: string; description: string }[] = [
  {
    value: 'interview',
    label: 'Initial Interview',
    description: 'Evaluate communication skills, experience, and overall suitability',
  },
  {
    value: 'yard_test',
    label: 'In-Yard Test',
    description: 'Assess vehicle handling and safety awareness in a controlled environment',
  },
  {
    value: 'road_test',
    label: 'Road Test',
    description: 'Observe real-world driving performance and decision-making',
  },
];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  new: 'New Application',
  in_progress: 'In Progress',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
  scheduled: 'Scheduled',
};