import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Task, TaskPriority, TaskStatus } from '../db/database'

export type TaskFormValue = {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string | null
}

type TaskEditorProps = {
  task?: Task
  onCreate: (input: TaskFormValue) => void
  onUpdate: (id: string, updates: TaskFormValue) => void
  onDelete: (id: string) => void
}

const emptyForm: TaskFormValue = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
}

export function TaskEditor({ task, onCreate, onUpdate, onDelete }: TaskEditorProps) {
  const [form, setForm] = useState<TaskFormValue>(emptyForm)
  const isNew = useMemo(() => !task, [task])

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ?? '',
      })
    } else {
      setForm(emptyForm)
    }
  }, [task])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (isNew) {
      onCreate({ ...form, dueDate: form.dueDate || null })
    } else if (task) {
      onUpdate(task.id, { ...form, dueDate: form.dueDate || null })
    }
  }

  return (
    <div className="panel editor">
      <div className="panel-header">
        <div>
          <h3>{isNew ? '新規作成' : 'タスク詳細 / 編集'}</h3>
          <p className="panel-subtitle">Microsoft To Do 風の実用的な編集体験</p>
        </div>
        {!isNew && task && (
          <button className="ghost" onClick={() => onDelete(task.id)}>
            削除
          </button>
        )}
      </div>
      <form className="task-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>タイトル *</span>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="例: 仕様確認のミーティング"
            required
          />
        </label>
        <label className="field">
          <span>詳細</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="内容やメモを記入"
            rows={4}
          />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>ステータス</span>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
            >
              <option value="todo">未着手</option>
              <option value="in-progress">進行中</option>
              <option value="done">完了</option>
            </select>
          </label>
          <label className="field">
            <span>優先度</span>
            <select
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>期限</span>
          <input
            type="date"
            value={form.dueDate ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          />
        </label>
        <div className="form-actions">
          <div className="timestamps">
            {task && (
              <>
                <span className="muted">作成: {new Date(task.createdAt).toLocaleString()}</span>
                <span className="muted">更新: {new Date(task.updatedAt).toLocaleString()}</span>
              </>
            )}
          </div>
          <button type="submit" className="primary">
            {isNew ? '追加する' : '更新する'}
          </button>
        </div>
      </form>
    </div>
  )
}
