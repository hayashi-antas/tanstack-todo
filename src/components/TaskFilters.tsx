import type { TaskFilter } from '../db/database'
import { taskPrioritySchema, taskStatusSchema } from '../db/schema'

type TaskFiltersProps = {
  value: TaskFilter
  onChange: (filters: TaskFilter) => void
}

const statusOptions = ['all', ...taskStatusSchema.options] as const
const priorityOptions = ['all', ...taskPrioritySchema.options] as const

export function TaskFilters({ value, onChange }: TaskFiltersProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>フィルタ</h3>
        <p className="panel-subtitle">状態・優先度・期限で絞り込み</p>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>ステータス</span>
          <select
            value={value.status ?? 'all'}
            onChange={(e) => onChange({ ...value, status: e.target.value as TaskFilter['status'] })}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'すべて' : statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>優先度</span>
          <select
            value={value.priority ?? 'all'}
            onChange={(e) => onChange({ ...value, priority: e.target.value as TaskFilter['priority'] })}
          >
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'all' ? 'すべて' : priorityLabels[priority]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>期限（まで）</span>
        <input
          type="date"
          value={value.dueBefore ?? ''}
          onChange={(e) => onChange({ ...value, dueBefore: e.target.value || undefined })}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(value.includeDone)}
          onChange={(e) => onChange({ ...value, includeDone: e.target.checked })}
        />
        <span>完了済みも表示する</span>
      </label>
    </div>
  )
}

const statusLabels: Record<string, string> = {
  all: 'すべて',
  todo: '未着手',
  'in-progress': '進行中',
  done: '完了',
}

const priorityLabels: Record<string, string> = {
  all: 'すべて',
  low: '低',
  medium: '中',
  high: '高',
}
