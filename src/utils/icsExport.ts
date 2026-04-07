import { ADMIN_EMAILS } from '@/constants/actionItems';
import { ActionItem } from '@/types/operations';

const APP_URL = 'https://workshop-eight-xi.vercel.app/action-log';

function buildEmailBody(item: ActionItem): string {
  const statusLabel = item.status.replace('_', ' ').toUpperCase();
  const progressLines = item.progress_lines || [];
  const completedCount = progressLines.filter(l => l.completed).length;

  let body = `ACTION ITEM: ${item.title}\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (item.description) body += `Description: ${item.description}\n\n`;

  body += `Status: ${statusLabel}\n`;
  body += `Priority: ${item.priority.toUpperCase()}\n`;
  body += `Assigned to: ${item.assigned_to || 'Unassigned'}\n`;
  if (item.category) body += `Category: ${item.category}\n`;
  if (item.due_date) body += `Due date: ${item.due_date}\n`;
  if (item.completed_date) body += `Completed: ${item.completed_date}\n`;

  if (progressLines.length > 0) {
    body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `PROGRESS LINES (${completedCount}/${progressLines.length} completed)\n\n`;
    progressLines.forEach((l, i) => {
      const marker = l.completed ? '✓' : '○';
      const dateStr = l.target_date ? ` [Target: ${l.target_date}]` : '';
      body += `  ${marker} ${i + 1}. ${l.note}${dateStr}\n`;
    });
  }

  body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `View & update in app: ${APP_URL}\n`;

  return body;
}

function getRecipientEmail(assignedTo?: string): string {
  if (!assignedTo) return '';
  return ADMIN_EMAILS[assignedTo] || '';
}

/** Open a mailto: link to email a single action item to its assigned user */
export function emailActionItem(item: ActionItem) {
  const to = getRecipientEmail(item.assigned_to);
  const subject = `[Action Item] ${item.title}${item.due_date ? ` — Due: ${item.due_date}` : ''}`;
  const body = buildEmailBody(item);

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank');
}

/** Open a mailto: link to email multiple action items (e.g. for the current tab's user) */
export function emailBulkActionItems(items: ActionItem[], recipientName?: string) {
  const to = recipientName ? getRecipientEmail(recipientName) : '';

  const subject = `Action Items Summary — ${items.length} items${recipientName ? ` for ${recipientName}` : ''}`;

  let body = `ACTION ITEMS SUMMARY\n`;
  body += `${items.length} items${recipientName ? ` assigned to ${recipientName}` : ''}\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  items.forEach((item, idx) => {
    const statusLabel = item.status.replace('_', ' ').toUpperCase();
    const pLines = item.progress_lines || [];
    const plDone = pLines.filter(l => l.completed).length;

    body += `${idx + 1}. ${item.title}\n`;
    body += `   Status: ${statusLabel} | Priority: ${item.priority.toUpperCase()}`;
    if (item.due_date) body += ` | Due: ${item.due_date}`;
    body += '\n';

    if (pLines.length > 0) {
      body += `   Progress: ${plDone}/${pLines.length} lines completed\n`;
      pLines.forEach((l) => {
        body += `     ${l.completed ? '✓' : '○'} ${l.note}${l.target_date ? ` [${l.target_date}]` : ''}\n`;
      });
    }
    body += '\n';
  });

  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `View & update in app: ${APP_URL}\n`;

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank');
}
