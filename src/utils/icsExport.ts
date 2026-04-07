import { ActionItem } from '@/types/operations';

const APP_URL = 'https://workshop-eight-xi.vercel.app/action-log';

function formatICSTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatICSDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildEventBlock(item: ActionItem, dtstamp: string): string {
  const now = new Date();
  const eventDate = item.due_date ? new Date(item.due_date) : new Date(now.getTime() + 86400000);
  const dtstart = formatICSDateOnly(eventDate);
  const endDate = new Date(eventDate);
  endDate.setDate(endDate.getDate() + 1);
  const dtend = formatICSDateOnly(endDate);

  const priorityMap: Record<string, string> = { urgent: '1', high: '2', medium: '5', low: '9' };
  const vcalPriority = priorityMap[item.priority] || '5';

  const statusLabel = item.status.replace('_', ' ').toUpperCase();
  const progressLines = item.progress_lines || [];
  const completedCount = progressLines.filter(l => l.completed).length;
  const progressSummary = progressLines.length > 0
    ? `\n\nProgress: ${completedCount}/${progressLines.length} lines completed`
    : '';

  const linesDetail = progressLines.length > 0
    ? '\n\nProgress Lines:\n' + progressLines.map((l, i) =>
      `${l.completed ? '✓' : '○'} ${i + 1}. ${l.note}${l.target_date ? ` (Target: ${l.target_date})` : ''}`
    ).join('\n')
    : '';

  const description = escapeICS(
    `${item.description || 'No description'}\n\n` +
    `Status: ${statusLabel}\n` +
    `Priority: ${item.priority.toUpperCase()}\n` +
    `Assigned to: ${item.assigned_to || 'Unassigned'}\n` +
    `Category: ${item.category || 'N/A'}` +
    progressSummary +
    linesDetail +
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `View & update in app: ${APP_URL}`
  );

  const icsStatus = progressLines.length > 0 && completedCount < progressLines.length
    ? 'IN-PROCESS'
    : item.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION';

  return [
    'BEGIN:VEVENT',
    `UID:${item.id}@workshop-eight-xi.vercel.app`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${escapeICS(`[Action] ${item.title}`)}`,
    `DESCRIPTION:${description}`,
    `URL:${APP_URL}`,
    `PRIORITY:${vcalPriority}`,
    `STATUS:${icsStatus}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Action item due: ${escapeICS(item.title)}`,
    'END:VALARM',
    'END:VEVENT'
  ].join('\r\n');
}

function wrapCalendar(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mata Fleet Management//Action Log//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mata Action Items',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadSingleICS(item: ActionItem) {
  const dtstamp = formatICSTimestamp(new Date());
  const event = buildEventBlock(item, dtstamp);
  const ics = wrapCalendar([event]);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `action-item-${item.title.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadBulkICS(items: ActionItem[]) {
  const dtstamp = formatICSTimestamp(new Date());
  const events = items.map(item => buildEventBlock(item, dtstamp));
  const ics = wrapCalendar(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `action-log-${new Date().toISOString().split('T')[0]}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}
