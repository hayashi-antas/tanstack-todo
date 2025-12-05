import { z } from 'zod'
import { taskInputSchema, taskSchema, type Task, type TaskInput, type TaskPriority, type TaskStatus, type TaskUpdate } from './schema'

const STORAGE_KEY = 'tanstack-todo/tasks'

type CollectionConfig<TSchema extends z.ZodTypeAny> = {
  name: string
  schema: TSchema
  primaryKey: keyof z.infer<TSchema>
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
        this.tasks = parsed.data
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

  async getTasks(): Promise<Task[]> {
    return [...this.tasks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  async addTask(input: TaskInput): Promise<Task> {
    const parsed = taskInputSchema.parse(input)
    const timestamp = this.now()
    const task: Task = {
      id: crypto.randomUUID(),
      ...parsed,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.tasks.unshift(task)
    this.persist()
    return task
  }

  async updateTask(update: TaskUpdate): Promise<Task> {
    const idx = this.tasks.findIndex((t) => t.id === update.id)
    if (idx === -1) throw new Error('Task not found')
    const merged: Task = taskSchema.parse({
      ...this.tasks[idx],
      ...update,
      updatedAt: this.now(),
    })
    this.tasks[idx] = merged
    this.persist()
    return merged
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks = this.tasks.filter((task) => task.id !== id)
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
