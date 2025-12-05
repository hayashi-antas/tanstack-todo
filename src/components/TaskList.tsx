import type { Task } from '../db/database'

const statusLabel: Record<Task['status'], string> = {
  todo: '未着手',
  'in-progress': '進行中',
  done: '完了',
}

const priorityTone: Record<Task['priority'], string> = {
  low: 'badge soft',
  medium: 'badge',
  high: 'badge strong',
}

type TaskListProps = {
  tasks: Task[]
  selectedId?: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export function TaskList({ tasks, selectedId, onSelect, onCreate, onDelete }: TaskListProps) {
  return (
    <div className="panel list-panel">
      <div className="panel-header">
        <div>
          <h3>タスクリスト</h3>
          <p className="panel-subtitle">軽いリスト操作と素早い切り替え</p>
        </div>
        <button className="primary" onClick={onCreate}>
          + 新規タスク
        </button>
      </div>
      <div className="task-list" role="list">
        {tasks.length === 0 && <p className="empty">タスクがありません。追加してください。</p>}
        {tasks.map((task) => (
          <article
            key={task.id}
            role="listitem"
            className={`task-item ${selectedId === task.id ? 'active' : ''}`}
            onClick={() => onSelect(task.id)}
          >
            <div className="task-item-header">
              <div className="task-title">{task.title}</div>
              <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                <button className="ghost" onClick={() => onDelete(task.id)}>
                  削除
                </button>
              </div>
            </div>
            <div className="task-meta">
              <span className={priorityTone[task.priority]}>{priorityLabel[task.priority]}</span>
              <span className="badge-outline">{statusLabel[task.status]}</span>
              {task.dueDate && <span className="muted">期限: {task.dueDate}</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

const priorityLabel: Record<Task['priority'], string> = {
  low: '低',
  medium: '中',
  high: '高',
}
