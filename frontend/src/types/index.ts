export interface ProjectStatus {
  id: number
  name: string
  order: number
  is_default: boolean
}

export interface Project {
  id: number
  key: string
  name: string
  description: string
  item_count: number
  statuses: ProjectStatus[]
}

export const SPRINT_RELEASE_STATUSES = [
  'planned',
  'in progress',
  'done'
] as const

export type SprintReleaseStatus = (typeof SPRINT_RELEASE_STATUSES)[number] | string

export const DEFAULT_SPRINT_RELEASE_STATUSES: ProjectStatus[] = SPRINT_RELEASE_STATUSES.map(
  (name, index) => ({
    id: index + 1,
    name,
    order: index,
    is_default: name === 'planned'
  })
)

export interface Release {
  id: number
  project_key: string
  name: string
  description: string
  status?: SprintReleaseStatus
  start_date: string | null
  end_date: string | null
  done_at?: string | null
  created_at: string
}

export interface Sprint {
  id: number
  project_key: string
  release_id: number | null
  name: string
  description: string
  status?: SprintReleaseStatus
  start_date: string | null
  end_date: string | null
  done_at?: string | null
  created_at: string
}

export interface ContextData {
  id: number
  work_item_key: string
  user: string | null
  updated_by?: string | null
  summary: string
  timestamp: string
}

export const STANDARD_STATUSES = [
  'todo',
  'planned',
  'in progress',
  'blocked',
  'review',
  'done',
  'cancelled'
] as const

export const ALL_PROGRESS_STATUSES = [
  'in progress',
  'planned',
  'blocked',
  'review',
  'done',
  'cancelled',
  'todo'
] as const

export type StandardStatus = (typeof STANDARD_STATUSES)[number]
export type ProgressStatus = (typeof ALL_PROGRESS_STATUSES)[number] | string

export const DEFAULT_PROJECT_STATUSES: ProjectStatus[] = STANDARD_STATUSES.map(
  (name, index) => ({
    id: index + 1,
    name,
    order: index,
    is_default: name === 'todo'
  })
)

export const PROGRESS_STATUS_OPTIONS: string[] = [...ALL_PROGRESS_STATUSES]

export interface ProgressEntry {
  id: number
  work_item_key: string
  created_by: string | null
  agent_id?: string
  hostname?: string
  summary: string
  proof: string
  status: ProgressStatus
  created_at: string
  updated_at?: string | null
  updated_by?: string | null
}

export interface SubtaskSummary {
  key: string
  title: string
}

export interface WorkItem {
  id: number | string
  key: string
  is_support?: boolean
  parent_key: string | null
  title: string
  description?: string
  status: ProgressStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  project_key: string
  active_assignee: string | null
  created_by: string
  updated_by: string | null
  assigned: string[]
  watching: string[]
  source: string
  start_date: string | null
  target_date: string | null
  sprint_id: number | null
  release_id: number | null
  created: string
  updated: string
  context?: ContextData | null
  progress?: ProgressEntry[]
  subtasks?: SubtaskSummary[]
}

export interface UserSummary {
  id: number
  username: string
}

export interface UserProfile {
  id: number
  username: string
  email: string
  is_staff: boolean
}

export interface APIKeyItem {
  id: number
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  is_active: boolean
}

export interface BackendInfo {
  python?: string
  django?: string
  ninja?: string
  database?: string
  ingress_port?: number
}

export interface SearchItemResult {
  work_item: WorkItem
  score: number
  vector_distance: number | null
  rank_vector: number | null
  rank_keyword: number | null
  match_type: 'hybrid' | 'vector' | 'keyword' | 'exact'
  snippet: string
}

export interface SearchResponse {
  query: string
  mode: 'hybrid' | 'vector' | 'keyword'
  total: number
  results: SearchItemResult[]
}

export const INCIDENT_STATUSES = [
  'reported',
  'ongoing',
  'done',
  'no longer relevant'
] as const

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number] | string

export const DEFAULT_INCIDENT_STATUSES: ProjectStatus[] = INCIDENT_STATUSES.map(
  (name, index) => ({
    id: index + 1,
    name,
    order: index,
    is_default: name === 'reported'
  })
)

export const MONITORING_LOG_STATUSES = ['ok', 'error'] as const

export type MonitoringLogStatus = (typeof MONITORING_LOG_STATUSES)[number] | string

export const DEFAULT_MONITORING_LOG_STATUSES: ProjectStatus[] = MONITORING_LOG_STATUSES.map(
  (name, index) => ({
    id: index + 1,
    name,
    order: index,
    is_default: name === 'ok'
  })
)

export interface MonitoringLogLink {
  id: number
  key: string
  status: MonitoringLogStatus
  agent_id: string
  created_at: string
}

export interface Incident {
  id: number
  key: string
  project_key: string
  title: string
  cause: string
  description?: string
  investigation_note: string
  status: IncidentStatus
  work_items: SubtaskSummary[]
  work_item_keys: string[]
  monitoring_log_ids: number[]
  monitoring_log_keys: string[]
  monitoring_logs: MonitoringLogLink[]
  created_by: string
  updated_by?: string | null
  created_at: string
  updated_at: string
}

export interface IncidentSearchResult {
  incident: Incident
  score: number
  vector_distance: number | null
  rank_vector: number | null
  rank_keyword: number | null
  match_type: 'hybrid' | 'vector' | 'keyword' | 'exact'
  snippet: string
}

export interface IncidentSearchResponse {
  query: string
  mode: 'hybrid' | 'vector' | 'keyword'
  total: number
  results: IncidentSearchResult[]
}

export interface MonitoringLog {
  id: number
  key: string
  project_key: string
  agent_id: string
  description: string
  status: MonitoringLogStatus
  incident_id: number | null
  incident_key: string | null
  jira_url: string
  created_by: string
  created_at: string
}

