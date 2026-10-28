export function formatAnalysisTimestamp(value) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date)
}

export function sortAnalysisHistory(items) {
  return [...items].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : Number.NEGATIVE_INFINITY
    const bTime = b.created_at ? Date.parse(b.created_at) : Number.NEGATIVE_INFINITY
    const safeATime = Number.isNaN(aTime) ? Number.NEGATIVE_INFINITY : aTime
    const safeBTime = Number.isNaN(bTime) ? Number.NEGATIVE_INFINITY : bTime
    return safeBTime - safeATime || b.id.localeCompare(a.id)
  })
}
