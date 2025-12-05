import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import './App.css'
import { TaskFilters } from './components/TaskFilters'
import { TaskList } from './components/TaskList'
import { TaskEditor, type TaskFormValue } from './components/TaskEditor'
import { db, type Task, type TaskFilter, type TaskStatus } from './db/database'

function App() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [filters, setFilters] = useState<TaskFilter>({ includeDone: true })

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: () => db.getTasks() })

  const filteredTasks = useMemo(() => {
    if (!tasksQuery.data) return []
    return db.applyFilters(tasksQuery.data, filters)
  }, [filters, tasksQuery.data])

  const selectedTask = useMemo(() => {
    if (!tasksQuery.data) return undefined
    return tasksQuery.data.find((task) => task.id === selectedId)
  }, [selectedId, tasksQuery.data])

  const statusBuckets = useMemo(() => {
    const base = { todo: [] as Task[], 'in-progress': [] as Task[], done: [] as Task[] }
    for (const task of filteredTasks) {
      base[task.status].push(task)
    }
    return base
  }, [filteredTasks])

  const createTask = useMutation({
    mutationFn: (input: TaskFormValue) => db.addTask(input),
    onSuccess: (created) => {
      setSelectedId(created.id)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const updateTask = useMutation({
    mutationFn: (payload: { id: string; updates: TaskFormValue }) => db.updateTask({ id: payload.id, ...payload.updates }),
    onSuccess: (_, variables) => {
      setSelectedId(variables.id)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => db.deleteTask(id),
    onSuccess: (_, id) => {
      if (selectedId === id) setSelectedId(undefined)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const handleCreate = (input: TaskFormValue) => {
    createTask.mutate(input)
  }

  const handleUpdate = (id: string, updates: TaskFormValue) => {
    updateTask.mutate({ id, updates })
  }

  const toFormValue = (task: Task): TaskFormValue => ({
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? '',
  })

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    handleUpdate(task.id, { ...toFormValue(task), status })
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">TanStack DB + React + Zod</p>
          <h1>Modern ToDo</h1>
          <p className="lede">
            Google ToDo の軽さ、Microsoft To Do の実用性、GitHub Issues のステータス管理。すべてブラウザだけで完結。
          </p>
        </div>
        <div className="meta">
          <span className="badge">IndexedDB / localStorage 永続化</span>
          <span className="badge-outline">オフライン対応</span>
        </div>
      </header>

      <div className="layout">
        <TaskList
          tasks={filteredTasks}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onCreate={() => setSelectedId(undefined)}
          onDelete={(id) => deleteTask.mutate(id)}
        />

        <section className="panel board">
          <div className="panel-header">
            <div>
              <h3>ボードビュー</h3>
              <p className="panel-subtitle">GitHub Issues のようにステータスを俯瞰</p>
            </div>
          </div>
          <div className="board-grid">
            {(['todo', 'in-progress', 'done'] as const).map((status) => (
              <div key={status} className="board-column">
                <div className="board-column-header">
                  <h4>{statusLabel[status]}</h4>
                  <span className="muted">{statusBuckets[status].length}</span>
                </div>
                <div className="board-column-body">
                  {statusBuckets[status].length === 0 && <p className="empty">なし</p>}
                  {statusBuckets[status].map((task) => (
                    <div key={task.id} className="board-card">
                      <div className="board-card-top">
                        <span className={`badge ${priorityTone[task.priority]}`}>{priorityLabel[task.priority]}</span>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                        >
                          <option value="todo">未着手</option>
                          <option value="in-progress">進行中</option>
                          <option value="done">完了</option>
                        </select>
                      </div>
                      <button className="link" onClick={() => setSelectedId(task.id)}>
                        {task.title}
                      </button>
                      <p className="muted small">{task.description || '詳細なし'}</p>
                      <div className="card-footer">
                        {task.dueDate && <span className="muted">期限: {task.dueDate}</span>}
                        <span className="muted">更新: {new Date(task.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <TaskFilters value={filters} onChange={setFilters} />
        </section>

        <TaskEditor
          task={selectedTask}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={(id) => deleteTask.mutate(id)}
        />
      </div>
    </div>
  )
}

const statusLabel: Record<Task['status'], string> = {
  todo: '未着手',
  'in-progress': '進行中',
  done: '完了',
}

const priorityLabel: Record<Task['priority'], string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const priorityTone: Record<Task['priority'], string> = {
  low: 'soft',
  medium: '',
  high: 'strong',
}

export default App
