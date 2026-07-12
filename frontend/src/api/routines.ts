import { apiClient } from './client'

export type RoutineType = 'HABIT' | 'TASK' | 'OBLIGATION'
export type TargetPeriod = 'WEEK' | 'MONTH'

export interface Routine {
  id: string
  userId: string
  name: string
  description?: string
  type: RoutineType
  category?: string
  color: string
  icon: string
  rruleString: string
  startDate: string
  endDate?: string
  active: boolean
  hasQuantity: boolean
  unit?: string
  targetCount?: number
  targetPeriod?: TargetPeriod
  createdAt: string
  updatedAt: string
}

export interface RoutineCompletion {
  id: string
  routineId: string
  date: string
  done: boolean
  value?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export interface RoutineStats {
  totalCompletions: number
  successRate: number
  currentStreak: number
  longestStreak: number
  thisMonth: number
  thisYear: number
}

export interface TodayItem {
  routine: Routine
  completion: RoutineCompletion | null
  isDue: boolean
}

export type RoutineInput = {
  name: string
  rruleString: string
  description?: string
  type?: RoutineType
  category?: string
  color?: string
  icon?: string
  startDate?: string
  endDate?: string
  active?: boolean
  hasQuantity?: boolean
  unit?: string
  targetCount?: number
  targetPeriod?: TargetPeriod
}

export const TYPE_LABELS: Record<RoutineType, string> = {
  HABIT: 'Habitude',
  TASK: 'Tâche',
  OBLIGATION: 'Obligation',
}

export const TYPE_COLORS: Record<RoutineType, string> = {
  HABIT: '#7A9E7E',
  TASK: '#C4775A',
  OBLIGATION: '#5A8AC4',
}

export const routinesApi = {
  getAll: (params?: { type?: RoutineType; active?: boolean; search?: string; category?: string }) => {
    const q = new URLSearchParams()
    if (params?.type) q.set('type', params.type)
    if (params?.active !== undefined) q.set('active', String(params.active))
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    const qs = q.toString()
    return apiClient<{ routines: Routine[] }>(`/api/routines${qs ? `?${qs}` : ''}`)
  },

  getOne: (id: string) =>
    apiClient<{ routine: Routine }>(`/api/routines/${id}`),

  create: (data: RoutineInput) =>
    apiClient<{ routine: Routine }>('/api/routines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<RoutineInput> & { active?: boolean }) =>
    apiClient<{ routine: Routine }>(`/api/routines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),

  getCompletions: (id: string, params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    const qs = q.toString()
    return apiClient<{ completions: RoutineCompletion[] }>(
      `/api/routines/${id}/completions${qs ? `?${qs}` : ''}`
    )
  },

  upsertCompletion: (id: string, data: { date: string; done?: boolean; value?: number; note?: string }) =>
    apiClient<{ completion: RoutineCompletion }>(`/api/routines/${id}/completions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCompletion: (id: string, date: string) =>
    apiClient<{ ok: boolean }>(
      `/api/routines/${id}/completions/${encodeURIComponent(date)}`,
      { method: 'DELETE' }
    ),

  getToday: () =>
    apiClient<{ items: TodayItem[] }>('/api/routines/today'),

  getGrid: (year: number, month: number) =>
    apiClient<{ routines: Routine[]; completions: RoutineCompletion[]; year: number; month: number }>(
      `/api/routines/grid?year=${year}&month=${month}`
    ),

  getStats: (id: string) =>
    apiClient<RoutineStats>(`/api/routines/${id}/stats`),
}
