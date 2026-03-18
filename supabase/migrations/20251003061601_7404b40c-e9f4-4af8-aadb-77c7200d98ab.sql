-- Phase 1: Database Foundation for Enhanced Job Card System

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE public.inspection_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.inspection_item_status AS ENUM ('pass', 'fail', 'attention', 'not_applicable');
CREATE TYPE public.fault_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.fault_status AS ENUM ('identified', 'acknowledged', 'job_card_created', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.work_order_status AS ENUM ('draft', 'pending_approval', 'approved', 'in_progress', 'pending_documentation', 'pending_closure', 'completed', 'cancelled');
CREATE TYPE public.document_type AS ENUM ('before_photo', 'after_photo', 'progress_photo', 'receipt', 'invoice', 'cra_report', 'quality_check', 'completion_certificate', 'other');
CREATE TYPE public.document_approval_status AS ENUM ('pending', 'approved', 'rejected', 'revision_required');
CREATE TYPE public.alert_type AS ENUM ('repeat_repair_3month', 'similar_component', 'similar_category', 'fleet_pattern', 'quality_issue', 'cost_overrun');
CREATE TYPE public.alert_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.alert_status AS ENUM ('active', 'acknowledged', 'investigating', 'resolved', 'dismissed');
CREATE TYPE public.approval_level AS ENUM ('technician', 'quality_control', 'supervisor', 'final_approval');

-- =====================================================
-- A. INSPECTION SYSTEM TABLES
-- =====================================================

-- Master inspection records
CREATE TABLE public.vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_number TEXT NOT NULL UNIQUE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    inspector_name TEXT NOT NULL,
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    inspection_type TEXT NOT NULL, -- 'scheduled', 'pre_trip', 'post_trip', 'complaint_based'
    status inspection_status NOT NULL DEFAULT 'pending',
    odometer_reading INTEGER,
    notes TEXT,
    digital_signature TEXT, -- Base64 encoded signature
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Individual checklist items per inspection
CREATE TABLE public.inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'Exterior', 'Tyres', 'Mechanical', 'Interior', etc.
    item_name TEXT NOT NULL,
    status inspection_item_status,
    notes TEXT,
    action_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Photo attachments linked to inspection items
CREATE TABLE public.inspection_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
    inspection_item_id UUID REFERENCES public.inspection_items(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type TEXT, -- 'condition', 'damage', 'general'
    caption TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    uploaded_by TEXT
);

-- Faults identified during inspections
CREATE TABLE public.inspection_faults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
    inspection_item_id UUID REFERENCES public.inspection_items(id) ON DELETE SET NULL,
    fault_description TEXT NOT NULL,
    severity fault_severity NOT NULL DEFAULT 'medium',
    requires_immediate_attention BOOLEAN DEFAULT false,
    estimated_cost NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- B. FAULT & WORK ORDER TABLES
-- =====================================================

-- Vehicle faults (database-driven replacement for hardcoded faults)
CREATE TABLE public.vehicle_faults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fault_number TEXT NOT NULL UNIQUE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    inspection_id UUID REFERENCES public.vehicle_inspections(id) ON DELETE SET NULL,
    inspection_fault_id UUID REFERENCES public.inspection_faults(id) ON DELETE SET NULL,
    fault_description TEXT NOT NULL,
    fault_category TEXT NOT NULL, -- 'Engine', 'Transmission', 'Brakes', 'Electrical', etc.
    component TEXT, -- Specific component affected
    severity fault_severity NOT NULL DEFAULT 'medium',
    status fault_status NOT NULL DEFAULT 'identified',
    reported_by TEXT NOT NULL,
    reported_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_date TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Track fault recurrence and patterns
CREATE TABLE public.fault_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    fault_id UUID NOT NULL REFERENCES public.vehicle_faults(id) ON DELETE CASCADE,
    job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
    work_order_id UUID,
    fault_category TEXT NOT NULL,
    component TEXT,
    repair_date DATE,
    cost NUMERIC(10, 2),
    technician_name TEXT,
    recurrence_count INTEGER DEFAULT 1,
    days_since_last_repair INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Formal work orders (separate from job cards)
CREATE TABLE public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number TEXT NOT NULL UNIQUE,
    job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    fault_id UUID REFERENCES public.vehicle_faults(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    scope_of_work TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status work_order_status NOT NULL DEFAULT 'draft',
    
    -- Resource allocation
    assigned_technician TEXT,
    estimated_hours NUMERIC(5, 2),
    actual_hours NUMERIC(5, 2),
    
    -- Scheduling
    scheduled_start_date TIMESTAMP WITH TIME ZONE,
    scheduled_end_date TIMESTAMP WITH TIME ZONE,
    actual_start_date TIMESTAMP WITH TIME ZONE,
    actual_completion_date TIMESTAMP WITH TIME ZONE,
    
    -- Cost estimation
    estimated_parts_cost NUMERIC(10, 2),
    estimated_labor_cost NUMERIC(10, 2),
    estimated_total_cost NUMERIC(10, 2),
    actual_parts_cost NUMERIC(10, 2),
    actual_labor_cost NUMERIC(10, 2),
    actual_total_cost NUMERIC(10, 2),
    currency TEXT DEFAULT 'ZAR',
    
    -- Quality and documentation
    requires_cra_report BOOLEAN DEFAULT false,
    cra_report_id UUID,
    quality_check_completed BOOLEAN DEFAULT false,
    documentation_complete BOOLEAN DEFAULT false,
    
    -- Approval tracking
    submitted_for_approval_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- All required documentation for work orders
CREATE TABLE public.work_order_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_format TEXT,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT false,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    verified_by TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    approval_status document_approval_status DEFAULT 'pending',
    rejection_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- C. QUALITY CONTROL TABLES
-- =====================================================

-- Corrective & Remedial Action reports
CREATE TABLE public.cra_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cra_number TEXT NOT NULL UNIQUE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    
    -- Issue identification
    issue_description TEXT NOT NULL,
    issue_category TEXT NOT NULL,
    discovery_date DATE NOT NULL,
    discovered_by TEXT NOT NULL,
    
    -- Root cause analysis
    root_cause TEXT NOT NULL,
    contributing_factors TEXT,
    risk_assessment TEXT,
    
    -- Corrective actions
    corrective_actions_taken TEXT NOT NULL,
    preventive_measures TEXT NOT NULL,
    follow_up_requirements TEXT,
    
    -- Testing and verification
    testing_results TEXT,
    verification_method TEXT,
    verified_by TEXT,
    verification_date DATE,
    
    -- Status and approval
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'approved', 'implemented'
    submitted_by TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Quality control checkpoints
CREATE TABLE public.quality_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    checkpoint_name TEXT NOT NULL,
    checkpoint_description TEXT,
    check_sequence INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'pass', 'fail', 'n/a'
    checked_by TEXT,
    checked_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    requires_action BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Required documentation checklist
CREATE TABLE public.work_completion_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    checklist_item TEXT NOT NULL,
    item_type TEXT NOT NULL, -- 'photo', 'receipt', 'report', 'signature', 'verification'
    is_mandatory BOOLEAN DEFAULT true,
    is_completed BOOLEAN DEFAULT false,
    completed_by TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    document_id UUID REFERENCES public.work_order_documents(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- D. ALERT & MONITORING TABLES
-- =====================================================

-- System-generated alerts
CREATE TABLE public.vehicle_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_number TEXT NOT NULL UNIQUE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    alert_type alert_type NOT NULL,
    alert_priority alert_priority NOT NULL DEFAULT 'medium',
    status alert_status NOT NULL DEFAULT 'active',
    
    -- Alert details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    trigger_details JSONB, -- Store structured data about what triggered the alert
    
    -- Related records
    related_work_order_id UUID REFERENCES public.work_orders(id),
    related_fault_id UUID REFERENCES public.vehicle_faults(id),
    related_job_card_id UUID REFERENCES public.job_cards(id),
    
    -- Response tracking
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    assigned_to TEXT,
    response_required_by TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pattern detection for same vehicle/component
CREATE TABLE public.recurring_issue_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type TEXT NOT NULL, -- 'same_vehicle', 'same_component', 'same_category', 'fleet_wide'
    
    -- Pattern identification
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    fault_category TEXT,
    component TEXT,
    
    -- Pattern metrics
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_occurrence_date DATE NOT NULL,
    last_occurrence_date DATE NOT NULL,
    average_days_between_occurrences NUMERIC(5, 1),
    total_cost NUMERIC(10, 2),
    
    -- Pattern analysis
    pattern_severity TEXT NOT NULL DEFAULT 'medium',
    requires_investigation BOOLEAN DEFAULT false,
    investigation_status TEXT DEFAULT 'pending',
    investigation_notes TEXT,
    
    -- Related records
    related_fault_ids JSONB DEFAULT '[]'::jsonb,
    related_work_order_ids JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notification delivery tracking
CREATE TABLE public.alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.vehicle_alerts(id) ON DELETE CASCADE,
    recipient_role TEXT NOT NULL, -- 'workshop_manager', 'quality_control', 'lead_technician', 'service_advisor'
    recipient_name TEXT,
    recipient_email TEXT,
    notification_method TEXT NOT NULL, -- 'email', 'sms', 'in_app', 'push'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    delivery_status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'bounced'
    error_message TEXT
);

-- =====================================================
-- E. DOCUMENT MANAGEMENT
-- =====================================================

-- Centralized document storage
CREATE TABLE public.work_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT NOT NULL UNIQUE,
    
    -- Document classification
    document_type document_type NOT NULL,
    document_category TEXT, -- Additional categorization
    title TEXT NOT NULL,
    description TEXT,
    
    -- File information
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_format TEXT NOT NULL,
    file_hash TEXT, -- For duplicate detection
    
    -- Related entities
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    cra_report_id UUID REFERENCES public.cra_reports(id) ON DELETE SET NULL,
    
    -- Quality and validation
    quality_validated BOOLEAN DEFAULT false,
    validation_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional structured data
    
    -- Audit trail
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    
    -- Retention and archive
    retention_period_days INTEGER,
    archive_date DATE,
    is_archived BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Approval workflow tracking
CREATE TABLE public.document_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.work_documents(id) ON DELETE CASCADE,
    approval_level approval_level NOT NULL,
    approval_sequence INTEGER NOT NULL,
    
    -- Approval status
    status document_approval_status NOT NULL DEFAULT 'pending',
    required_role TEXT NOT NULL,
    assigned_to TEXT,
    
    -- Approval details
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    revision_notes TEXT,
    
    -- Tracking
    notified_at TIMESTAMP WITH TIME ZONE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Inspection system indexes
CREATE INDEX idx_vehicle_inspections_vehicle ON public.vehicle_inspections(vehicle_id);
CREATE INDEX idx_vehicle_inspections_status ON public.vehicle_inspections(status);
CREATE INDEX idx_vehicle_inspections_date ON public.vehicle_inspections(inspection_date);
CREATE INDEX idx_inspection_items_inspection ON public.inspection_items(inspection_id);
CREATE INDEX idx_inspection_items_status ON public.inspection_items(status);
CREATE INDEX idx_inspection_photos_inspection ON public.inspection_photos(inspection_id);
CREATE INDEX idx_inspection_faults_inspection ON public.inspection_faults(inspection_id);

-- Fault system indexes
CREATE INDEX idx_vehicle_faults_vehicle ON public.vehicle_faults(vehicle_id);
CREATE INDEX idx_vehicle_faults_status ON public.vehicle_faults(status);
CREATE INDEX idx_vehicle_faults_category ON public.vehicle_faults(fault_category);
CREATE INDEX idx_vehicle_faults_component ON public.vehicle_faults(component);
CREATE INDEX idx_vehicle_faults_reported_date ON public.vehicle_faults(reported_date);
CREATE INDEX idx_fault_history_vehicle ON public.fault_history(vehicle_id);
CREATE INDEX idx_fault_history_category_component ON public.fault_history(fault_category, component);
CREATE INDEX idx_fault_history_repair_date ON public.fault_history(repair_date);

-- Work order indexes
CREATE INDEX idx_work_orders_vehicle ON public.work_orders(vehicle_id);
CREATE INDEX idx_work_orders_job_card ON public.work_orders(job_card_id);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_work_orders_scheduled_start ON public.work_orders(scheduled_start_date);
CREATE INDEX idx_work_order_documents_work_order ON public.work_order_documents(work_order_id);
CREATE INDEX idx_work_order_documents_type ON public.work_order_documents(document_type);

-- Quality control indexes
CREATE INDEX idx_cra_reports_work_order ON public.cra_reports(work_order_id);
CREATE INDEX idx_cra_reports_vehicle ON public.cra_reports(vehicle_id);
CREATE INDEX idx_cra_reports_status ON public.cra_reports(status);
CREATE INDEX idx_quality_checks_work_order ON public.quality_checks(work_order_id);
CREATE INDEX idx_quality_checks_status ON public.quality_checks(status);
CREATE INDEX idx_work_completion_checklist_work_order ON public.work_completion_checklist(work_order_id);

-- Alert system indexes
CREATE INDEX idx_vehicle_alerts_vehicle ON public.vehicle_alerts(vehicle_id);
CREATE INDEX idx_vehicle_alerts_type ON public.vehicle_alerts(alert_type);
CREATE INDEX idx_vehicle_alerts_status ON public.vehicle_alerts(status);
CREATE INDEX idx_vehicle_alerts_priority ON public.vehicle_alerts(alert_priority);
CREATE INDEX idx_vehicle_alerts_created ON public.vehicle_alerts(created_at);
CREATE INDEX idx_recurring_patterns_vehicle ON public.recurring_issue_patterns(vehicle_id);
CREATE INDEX idx_recurring_patterns_type ON public.recurring_issue_patterns(pattern_type);
CREATE INDEX idx_recurring_patterns_category ON public.recurring_issue_patterns(fault_category);
CREATE INDEX idx_alert_notifications_alert ON public.alert_notifications(alert_id);
CREATE INDEX idx_alert_notifications_status ON public.alert_notifications(delivery_status);

-- Document management indexes
CREATE INDEX idx_work_documents_work_order ON public.work_documents(work_order_id);
CREATE INDEX idx_work_documents_type ON public.work_documents(document_type);
CREATE INDEX idx_work_documents_vehicle ON public.work_documents(vehicle_id);
CREATE INDEX idx_work_documents_uploaded_at ON public.work_documents(uploaded_at);
CREATE INDEX idx_document_approvals_document ON public.document_approvals(document_id);
CREATE INDEX idx_document_approvals_status ON public.document_approvals(status);
CREATE INDEX idx_document_approvals_level ON public.document_approvals(approval_level);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_faults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_faults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fault_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cra_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_completion_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_issue_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Authenticated users can view inspections" ON public.vehicle_inspections FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage inspections" ON public.vehicle_inspections FOR ALL USING (true);

CREATE POLICY "Authenticated users can view inspection items" ON public.inspection_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage inspection items" ON public.inspection_items FOR ALL USING (true);

CREATE POLICY "Authenticated users can view inspection photos" ON public.inspection_photos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage inspection photos" ON public.inspection_photos FOR ALL USING (true);

CREATE POLICY "Authenticated users can view inspection faults" ON public.inspection_faults FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage inspection faults" ON public.inspection_faults FOR ALL USING (true);

CREATE POLICY "Authenticated users can view vehicle faults" ON public.vehicle_faults FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage vehicle faults" ON public.vehicle_faults FOR ALL USING (true);

CREATE POLICY "Authenticated users can view fault history" ON public.fault_history FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage fault history" ON public.fault_history FOR ALL USING (true);

CREATE POLICY "Authenticated users can view work orders" ON public.work_orders FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage work orders" ON public.work_orders FOR ALL USING (true);

CREATE POLICY "Authenticated users can view work order documents" ON public.work_order_documents FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage work order documents" ON public.work_order_documents FOR ALL USING (true);

CREATE POLICY "Authenticated users can view CRA reports" ON public.cra_reports FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage CRA reports" ON public.cra_reports FOR ALL USING (true);

CREATE POLICY "Authenticated users can view quality checks" ON public.quality_checks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage quality checks" ON public.quality_checks FOR ALL USING (true);

CREATE POLICY "Authenticated users can view completion checklist" ON public.work_completion_checklist FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage completion checklist" ON public.work_completion_checklist FOR ALL USING (true);

CREATE POLICY "Authenticated users can view vehicle alerts" ON public.vehicle_alerts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage vehicle alerts" ON public.vehicle_alerts FOR ALL USING (true);

CREATE POLICY "Authenticated users can view recurring patterns" ON public.recurring_issue_patterns FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage recurring patterns" ON public.recurring_issue_patterns FOR ALL USING (true);

CREATE POLICY "Authenticated users can view alert notifications" ON public.alert_notifications FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage alert notifications" ON public.alert_notifications FOR ALL USING (true);

CREATE POLICY "Authenticated users can view work documents" ON public.work_documents FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage work documents" ON public.work_documents FOR ALL USING (true);

CREATE POLICY "Authenticated users can view document approvals" ON public.document_approvals FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage document approvals" ON public.document_approvals FOR ALL USING (true);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update updated_at timestamp trigger for all tables
CREATE TRIGGER update_vehicle_inspections_updated_at BEFORE UPDATE ON public.vehicle_inspections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inspection_items_updated_at BEFORE UPDATE ON public.inspection_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicle_faults_updated_at BEFORE UPDATE ON public.vehicle_faults
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cra_reports_updated_at BEFORE UPDATE ON public.cra_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicle_alerts_updated_at BEFORE UPDATE ON public.vehicle_alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_patterns_updated_at BEFORE UPDATE ON public.recurring_issue_patterns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_documents_updated_at BEFORE UPDATE ON public.work_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_approvals_updated_at BEFORE UPDATE ON public.document_approvals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_inspections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_faults;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quality_checks;