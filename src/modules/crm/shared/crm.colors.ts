export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // Contact status
  lead:                      { bg: 'bg-blue-100',    text: 'text-blue-700' },
  contact:                   { bg: 'bg-purple-100',  text: 'text-purple-700' },
  customer:                  { bg: 'bg-green-100',   text: 'text-green-700' },
  // Company status
  active:                    { bg: 'bg-green-100',   text: 'text-green-700' },
  inactive:                  { bg: 'bg-gray-100',    text: 'text-gray-500' },
  // Deal stages
  prospect:                  { bg: 'bg-amber-100',   text: 'text-amber-700' },
  qualified:                 { bg: 'bg-blue-100',    text: 'text-blue-700' },
  proposal:                  { bg: 'bg-purple-100',  text: 'text-purple-700' },
  negotiation:               { bg: 'bg-orange-100',  text: 'text-orange-700' },
  closed_won:                { bg: 'bg-green-100',   text: 'text-green-700' },
  closed_lost:               { bg: 'bg-red-100',     text: 'text-red-700' },
  // Task status
  todo:                      { bg: 'bg-gray-100',    text: 'text-gray-600' },
  in_progress:               { bg: 'bg-blue-100',    text: 'text-blue-700' },
  done:                      { bg: 'bg-green-100',   text: 'text-green-700' },
  cancelled:                 { bg: 'bg-gray-100',    text: 'text-gray-400' },
  // Ticket status
  open:                      { bg: 'bg-red-100',     text: 'text-red-700' },
  resolved:                  { bg: 'bg-green-100',   text: 'text-green-700' },
  closed:                    { bg: 'bg-gray-100',    text: 'text-gray-500' },
  // Call / meeting status
  planned:                   { bg: 'bg-blue-100',    text: 'text-blue-700' },
  completed:                 { bg: 'bg-green-100',   text: 'text-green-700' },
  missed:                    { bg: 'bg-red-100',     text: 'text-red-700' },
  scheduled:                 { bg: 'bg-blue-100',    text: 'text-blue-700' },
  // Priority
  low:                       { bg: 'bg-gray-100',    text: 'text-gray-500' },
  medium:                    { bg: 'bg-amber-100',   text: 'text-amber-700' },
  high:                      { bg: 'bg-red-100',     text: 'text-red-700' },
  critical:                  { bg: 'bg-rose-100',    text: 'text-rose-700' },
  // Lifecycle stage (HubSpot-style)
  subscriber:                { bg: 'bg-gray-100',    text: 'text-gray-600' },
  marketing_qualified_lead:  { bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  sales_qualified_lead:      { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  opportunity:               { bg: 'bg-purple-100',  text: 'text-purple-700' },
  evangelist:                { bg: 'bg-pink-100',    text: 'text-pink-700' },
  other:                     { bg: 'bg-gray-100',    text: 'text-gray-500' },
  // Lead status
  new:                       { bg: 'bg-blue-100',    text: 'text-blue-700' },
  open_deal:                 { bg: 'bg-purple-100',  text: 'text-purple-700' },
  unqualified:               { bg: 'bg-gray-100',    text: 'text-gray-500' },
  attempted_to_contact:      { bg: 'bg-amber-100',   text: 'text-amber-700' },
  connected:                 { bg: 'bg-green-100',   text: 'text-green-700' },
  bad_timing:                { bg: 'bg-orange-100',  text: 'text-orange-700' },
};

export function statusColor(value: string) {
  return STATUS_COLORS[value] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
}
