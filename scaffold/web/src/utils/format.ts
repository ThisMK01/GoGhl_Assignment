export function formatRelativeTime(isoDate: string | undefined): string {
  if (!isoDate) return 'now';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function formatTime(isoDate: string | undefined): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getContactShortCode(contact: string): string {
  const digits = contact.replace(/\D/g, '');
  return digits.slice(-3) || contact.slice(0, 2).toUpperCase();
}

export function getInitials(nameOrSub: string): string {
  const clean = nameOrSub.replace(/^u_/, '');
  return clean.slice(0, 2).toUpperCase();
}

export function getWorkspaceDisplayName(wsId: string): string {
  if (wsId === 'ws_acme') return 'Acme Corp';
  if (wsId === 'ws_globex') return 'Globex Inc';
  return wsId;
}

export function countSmsSegments(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 160);
}
