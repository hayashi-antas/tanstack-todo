import { useMemo, useState, type ReactNode } from 'react'
import { DndContext, PointerSensor, type DragEndEvent, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
    ;(Object.keys(base) as TaskStatus[]).forEach((status) => {
      base[status].sort((a, b) => a.order - b.order)
    })
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

  const persistBuckets = async (buckets: Record<TaskStatus, Task[]>) => {
    if (!tasksQuery.data) return
    const updates: Promise<unknown>[] = []

    ;(['todo', 'in-progress', 'done'] as const).forEach((status) => {
      const originals = tasksQuery.data
        .filter((task) => task.status === status)
        .sort((a, b) => a.order - b.order)

      const reservedIds = new Set(buckets[status].map((task) => task.id))
      const untouched = originals.filter((task) => !reservedIds.has(task.id))
      const ordered = [...buckets[status], ...untouched]

      ordered.forEach((task, index) => {
        const original = tasksQuery.data.find((t) => t.id === task.id)
        const needsUpdate = !original || original.status !== status || original.order !== index
        if (needsUpdate) {
          updates.push(db.updateTask({ id: task.id, status, order: index }))
        }
      })
    })

    if (updates.length) {
      await Promise.all(updates)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || !tasksQuery.data) return

    const activeId = active.id as string
    const overId = over.id as string
    const activeTask = tasksQuery.data.find((task) => task.id === activeId)
    if (!activeTask) return

    const sourceStatus = activeTask.status
    let targetStatus: TaskStatus = sourceStatus
    let targetIndex = 0

    if (overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '') as TaskStatus
      targetIndex = statusBuckets[targetStatus].length
    } else {
      const overTask = tasksQuery.data.find((task) => task.id === overId)
      if (!overTask) return
      targetStatus = overTask.status
      targetIndex = statusBuckets[targetStatus].findIndex((task) => task.id === overId)
    }

    const nextBuckets: Record<TaskStatus, Task[]> = {
      todo: [...statusBuckets.todo],
      'in-progress': [...statusBuckets['in-progress']],
      done: [...statusBuckets.done],
    }

    const sourceList = nextBuckets[sourceStatus]
    const fromIndex = sourceList.findIndex((task) => task.id === activeId)
    if (fromIndex === -1) return

    if (sourceStatus === targetStatus) {
      if (fromIndex === targetIndex) return
      nextBuckets[targetStatus] = arrayMove(sourceList, fromIndex, targetIndex)
    } else {
      const [moved] = sourceList.splice(fromIndex, 1)
      nextBuckets[targetStatus].splice(targetIndex, 0, { ...moved, status: targetStatus })
    }

    await persistBuckets(nextBuckets)
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
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="board-grid">
              {(['todo', 'in-progress', 'done'] as const).map((status) => (
                <BoardColumn key={status} status={status} count={statusBuckets[status].length}>
                  <SortableContext items={statusBuckets[status].map((task) => task.id)} strategy={verticalListSortingStrategy}>
                    {statusBuckets[status].length === 0 && <p className="empty">なし</p>}
                    {statusBuckets[status].map((task) => (
                      <SortableCard key={task.id} task={task} onSelect={(id) => setSelectedId(id)} onStatusChange={handleStatusChange} />
                    ))}
                  </SortableContext>
                </BoardColumn>
              ))}
            </div>
          </DndContext>
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

type SortableCardProps = {
  task: Task
  onSelect: (id: string) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

function SortableCard({ task, onSelect, onStatusChange }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.15)' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="board-card" {...attributes} {...listeners}>
      <div className="board-card-top">
        <span className={`badge ${priorityTone[task.priority]}`}>{priorityLabel[task.priority]}</span>
        <select value={task.status} onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}>
          <option value="todo">未着手</option>
          <option value="in-progress">進行中</option>
          <option value="done">完了</option>
        </select>
      </div>
      <button className="link" onClick={() => onSelect(task.id)}>
        {task.title}
      </button>
      <p className="muted small">{task.description || '詳細なし'}</p>
      <div className="card-footer">
        {task.dueDate && <span className="muted">期限: {task.dueDate}</span>}
        <span className="muted">更新: {new Date(task.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

type BoardColumnProps = {
  status: TaskStatus
  count: number
  children: ReactNode
}

function BoardColumn({ status, count, children }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` })

  return (
    <div className={`board-column ${isOver ? 'dropping' : ''}`}>
      <div className="board-column-header">
        <h4>{statusLabel[status]}</h4>
        <span className="muted">{count}</span>
      </div>
      <div ref={setNodeRef} className="board-column-body">
        {children}
      </div>
    </div>
  )
}

export default App
