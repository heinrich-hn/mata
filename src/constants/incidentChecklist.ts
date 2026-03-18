// Accident Reporting Checklist - Required steps when handling incidents

export interface ChecklistItem {
  id: number;
  question: string;
  category: "initial_report" | "emergency_response" | "documentation" | "third_party" | "police" | "follow_up";
}

export interface ChecklistResponse {
  item_id: number;
  response: boolean | null;
  notes?: string;
  completed_at?: string;
  completed_by?: string;
}

export interface IncidentChecklist {
  incident_id: string;
  responses: ChecklistResponse[];
  started_at?: string;
  completed_at?: string;
  completed_by?: string;
}

export const CHECKLIST_CATEGORIES = {
  initial_report: { label: "Initial Report", color: "blue" },
  emergency_response: { label: "Emergency Response", color: "red" },
  documentation: { label: "Documentation", color: "green" },
  third_party: { label: "Third Party Information", color: "orange" },
  police: { label: "Police & Legal", color: "purple" },
  follow_up: { label: "Follow-up Actions", color: "gray" },
} as const;

export const INCIDENT_CHECKLIST_ITEMS: ChecklistItem[] = [
  // Initial Report (1-2)
  {
    id: 1,
    question: "Was the damage/accident/incident reported immediately via WhatsApp?",
    category: "initial_report",
  },
  {
    id: 2,
    question: "Were photos and details (short but clear descriptions) included in the report?",
    category: "initial_report",
  },

  // Emergency Response (3-4)
  {
    id: 3,
    question: "Have injuries immediately been reported?",
    category: "emergency_response",
  },
  {
    id: 4,
    question: "Was the ambulance contacted?",
    category: "emergency_response",
  },

  // Police & Legal (5-6, 19-21, 23)
  {
    id: 5,
    question: "Was the case reported at the nearest Police Station?",
    category: "police",
  },
  {
    id: 6,
    question: "Were the Police on the scene?",
    category: "police",
  },

  // Documentation - Witnesses & Scene (7-8)
  {
    id: 7,
    question: "Were there any witnesses present and have their contact details been obtained?",
    category: "documentation",
  },
  {
    id: 8,
    question: "Was someone from Matanuska at the scene?",
    category: "documentation",
  },

  // Third Party Information (9-18)
  {
    id: 9,
    question: "Was the Third-Party Name and contact number collected?",
    category: "third_party",
  },
  {
    id: 10,
    question: "Were the Business name and contact numbers of the Third Party collected (if applicable) (Owner)?",
    category: "third_party",
  },
  {
    id: 11,
    question: "Was a photo of the number plate of the third-party vehicle taken?",
    category: "third_party",
  },
  {
    id: 12,
    question: "Were photos taken of the tyre quality of the third-party vehicle?",
    category: "third_party",
  },
  {
    id: 13,
    question: "Was a photo of the license disk of the third-party vehicle taken?",
    category: "third_party",
  },
  {
    id: 14,
    question: "Were photos taken of the damage to the third-party vehicle?",
    category: "third_party",
  },
  {
    id: 15,
    question: "Were photos of the insurance disk taken of the third-party vehicle?",
    category: "third_party",
  },

  // Documentation - Scene Photos (16-17)
  {
    id: 16,
    question: "Were photos of the surrounding area and truck position taken?",
    category: "documentation",
  },
  {
    id: 17,
    question: "Were photos of the tyre marks and the area of the point of impact taken?",
    category: "documentation",
  },

  // Third Party - Driver Documents (18)
  {
    id: 18,
    question: "Was a photo of the driver's license and identification documents taken of the Third Party?",
    category: "third_party",
  },

  // Police & Legal (19-21)
  {
    id: 19,
    question: "Was a traffic accident document production form obtained from the officer at the site?",
    category: "police",
  },
  {
    id: 20,
    question: "Were the name and the contact details of the police officer obtained?",
    category: "police",
  },
  {
    id: 21,
    question: "Were the driver's license, insurance documents, and registration book submitted to the police within 7 days?",
    category: "police",
  },

  // Follow-up Actions (22-23)
  {
    id: 22,
    question: "Was an accident report completed?",
    category: "follow_up",
  },
  {
    id: 23,
    question: "Was a police case number obtained within 24 hours?",
    category: "follow_up",
  },
];

// Helper function to get checklist items by category
export const getChecklistByCategory = () => {
  const grouped: Record<string, ChecklistItem[]> = {};

  for (const item of INCIDENT_CHECKLIST_ITEMS) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  }

  return grouped;
};

// Helper function to calculate checklist completion percentage
export const calculateChecklistProgress = (responses: ChecklistResponse[]): {
  total: number;
  completed: number;
  yes: number;
  no: number;
  pending: number;
  percentage: number;
} => {
  const total = INCIDENT_CHECKLIST_ITEMS.length;
  const completed = responses.filter(r => r.response !== null).length;
  const yes = responses.filter(r => r.response === true).length;
  const no = responses.filter(r => r.response === false).length;
  const pending = total - completed;
  const percentage = Math.round((completed / total) * 100);

  return { total, completed, yes, no, pending, percentage };
};