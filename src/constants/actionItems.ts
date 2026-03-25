export const ADMIN_USERS = [
  'Heinrich',
  'Alec',
  'Vimbai',
  'Paul',
  'Tanaka',
  'Cain',
] as const;

export const RESPONSIBLE_PERSONS = [
  ...ADMIN_USERS,
  'Operations Manager',
  'Fleet Manager',
  'Maintenance Manager',
  'Workshop Supervisor',
  'Safety Officer',
  'Finance Manager',
  'Logistics Coordinator',
  'HR Manager',
] as const;

export const ACTION_ITEM_PRIORITIES = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' }
] as const;

export const ACTION_ITEM_STATUSES = [
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
] as const;
