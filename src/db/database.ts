import { z } from 'zod'
import { taskInputSchema, taskSchema, type Task, type TaskInput, type TaskPriority, type TaskStatus, type TaskUpdate } from './schema'

const STORAGE_KEY = 'tanstack-todo/tasks'

type CollectionConfig<TSchema extends z.ZodTypeAny> = {
  name: string
  schema: TSchema
  primaryKey: keyof z.infer<TSchema>
}

const statusOrder: Record<TaskStatus, number> = {
  todo: 0,
  'in-progress': 1,
  done: 2,
}

export function createCollection<TSchema extends z.ZodTypeAny>(config: CollectionConfig<TSchema>) {
  return config
}

export const taskCollection = createCollection({
  name: 'tasks',
  schema: taskSchema,
  primaryKey: 'id' as const,
})

export type TaskFilter = {
  status?: TaskStatus | 'all'
  priority?: TaskPriority | 'all'
  includeDone?: boolean
  dueBefore?: string
}

class TanStackDatabase {
  private tasks: Task[] = []
  private storage: Storage

  constructor() {
    this.storage = typeof localStorage !== 'undefined' ? localStorage : this.createMemoryStorage()
    this.bootstrap()
  }

  private createMemoryStorage(): Storage {
    const memory = new Map<string, string>()
    return {
      length: memory.size,
      clear: () => memory.clear(),
      getItem: (key: string) => memory.get(key) ?? null,
      key: (index: number) => Array.from(memory.keys())[index] ?? null,
      removeItem: (key: string) => memory.delete(key),
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }
  }

  private bootstrap() {
    const saved = this.storage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = z.array(taskSchema).safeParse(JSON.parse(saved))
      if (parsed.success) {
        this.tasks = this.normalizeOrders(parsed.data)
        return
      }
    }

    this.persist()
  }

  private persist() {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.tasks))
  }

  private now() {
    return new Date().toISOString()
  }

  private nextOrderForStatus(status: TaskStatus) {
    const inStatus = this.tasks.filter((task) => task.status === status)
    if (inStatus.length === 0) return 0
    return Math.max(...inStatus.map((task) => task.order ?? 0)) + 1
  }

  private normalizeOrders(tasks: Task[]) {
    const buckets: Record<TaskStatus, Task[]> = {
      todo: [],
      'in-progress': [],
      done: [],
    }

    for (const task of tasks) {
      buckets[task.status].push({ ...task, order: task.order ?? 0 })
    }

    const normalized: Task[] = []

    (Object.keys(buckets) as TaskStatus[]).forEach((status) => {
      const sorted = buckets[status].sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })

      sorted.forEach((task, index) => {
        normalized.push({ ...task, status, order: index })
      })
    })

    return normalized
  }

  private normalizeStatusOrders(status: TaskStatus) {
    const ordered = this.tasks
      .filter((task) => task.status === status)
      .sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })

    ordered.forEach((task, index) => {
      const idx = this.tasks.findIndex((t) => t.id === task.id)
      if (idx !== -1) {
        this.tasks[idx] = { ...this.tasks[idx], order: index }
      }
    })
  }

  async getTasks(): Promise<Task[]> {
    return [...this.tasks].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status]
      if (statusDiff !== 0) return statusDiff
      if (a.order !== b.order) return (a.order ?? 0) - (b.order ?? 0)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }

  async addTask(input: TaskInput): Promise<Task> {
    const parsed = taskInputSchema.parse(input)
    const timestamp = this.now()
    const task: Task = {
      id: crypto.randomUUID(),
      ...parsed,
      order: parsed.order ?? this.nextOrderForStatus(parsed.status),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.tasks.push(task)
    this.normalizeStatusOrders(task.status)
    this.persist()
    return task
  }

  async updateTask(update: TaskUpdate): Promise<Task> {
    const idx = this.tasks.findIndex((t) => t.id === update.id)
    if (idx === -1) throw new Error('Task not found')
    const originalStatus = this.tasks[idx].status
    const targetStatus = update.status ?? this.tasks[idx].status
    const merged: Task = taskSchema.parse({
      ...this.tasks[idx],
      status: targetStatus,
      order: update.order ?? this.tasks[idx].order ?? this.nextOrderForStatus(targetStatus),
      ...update,
      updatedAt: this.now(),
    })
    this.tasks[idx] = merged
    this.normalizeStatusOrders(originalStatus)
    this.normalizeStatusOrders(merged.status)
    this.persist()
    return merged
  }

  async deleteTask(id: string): Promise<void> {
    const removed = this.tasks.find((task) => task.id === id)
    this.tasks = this.tasks.filter((task) => task.id !== id)
    if (removed) {
      this.normalizeStatusOrders(removed.status)
    }
    this.persist()
  }

  applyFilters(tasks: Task[], filter: TaskFilter) {
    return tasks.filter((task) => {
      if (!filter.includeDone && task.status === 'done') return false
      if (filter.status && filter.status !== 'all' && task.status !== filter.status) return false
      if (filter.priority && filter.priority !== 'all' && task.priority !== filter.priority) return false
      if (filter.dueBefore) {
        if (!task.dueDate) return false
        return new Date(task.dueDate).getTime() <= new Date(filter.dueBefore).getTime()
      }
      return true
    })
  }
}

export const db = new TanStackDatabase()

export type { Task, TaskInput, TaskStatus, TaskPriority } from './schema'
