export interface AnalysisHistoryItem {
  id: string
  created_at: string | null
  candidate_count: number
}

export function formatAnalysisTimestamp(value: string | null | undefined): string
export function sortAnalysisHistory<T extends AnalysisHistoryItem>(items: T[]): T[]
