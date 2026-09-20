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

export interface Release {
  id: number
  project_key: string
  name: string
  description: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface Sprint {
  id: number
  project_key: string
  release_id: number | null
  name: string
  description: string
  start_date: string | null
  end_date: string | null
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

export interface ProgressEntry {
  id: number
  work_item_key: string
  user: string | null
  summary: string
  proof: string
  status: 'COMPLETED' | 'IN_PROGRESS' | 'BLOCKED' | 'FAILED' | string
  timestamp: string
}

export interface WorkItem {
  id: number | string
  key: string
  parent_key: string | null
  title: string
  description: string
  status: string
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
  context: ContextData | null
  progress: ProgressEntry[]
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
