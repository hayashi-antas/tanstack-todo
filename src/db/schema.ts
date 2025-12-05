import { z } from 'zod'

export const taskStatusSchema = z.enum(['todo', 'in-progress', 'done'])
export type TaskStatus = z.infer<typeof taskStatusSchema>

export const taskPrioritySchema = z.enum(['low', 'medium', 'high'])
export type TaskPriority = z.infer<typeof taskPrioritySchema>

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'タイトルは必須です'),
  description: z.string().optional().default(''),
  status: taskStatusSchema.default('todo'),
  priority: taskPrioritySchema.default('medium'),
  dueDate: z.string().nullable().optional(),
  order: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Task = z.infer<typeof taskSchema>

export const taskInputSchema = taskSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    dueDate: z.string().nullable().optional(),
    order: z.number().int().nonnegative().optional(),
  })

export type TaskInput = z.infer<typeof taskInputSchema>

export type TaskUpdate = Partial<Omit<Task, 'id' | 'createdAt'>> & { id: string }
