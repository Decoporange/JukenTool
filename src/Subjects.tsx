import React, { useState, useEffect, useCallback } from 'react'
import type { Subject } from './types'
import { getSubjects, addSubject, updateSubject, deleteSubject } from './db'
import { PRESET_COLORS } from './constants'

// ── Color Picker ──────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {/* Preset swatches */}
      <div className="color-swatches">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`color-swatch${value.toLowerCase() === c.toLowerCase() ? ' color-swatch--selected' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
            aria-label={`色 ${c}`}
            aria-pressed={value.toLowerCase() === c.toLowerCase()}
          />
        ))}
      </div>

      {/* Native color input for custom colors */}
      <div className="color-custom-row">
        <span className="color-custom-label">カスタム</span>
        <input
          type="color"
          className="color-input-native"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="カスタムカラーを選択"
        />
        <span className="color-hex-label">{value.toUpperCase()}</span>
      </div>
    </div>
  )
}

// ── Subject Form Modal (shared for add and edit) ───────────────────────────────

interface SubjectFormModalProps {
  subject?: Subject   // provided = edit mode, absent = add mode
  maxOrder: number
  onClose: () => void
  onSaved: () => void
}

function SubjectFormModal({ subject, maxOrder, onClose, onSaved }: SubjectFormModalProps) {
  const isEdit = !!subject
  const [name,   setName]   = useState(subject?.name  ?? '')
  const [color,  setColor]  = useState(subject?.color ?? PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('教科名を入力してください')
      return
    }
    setSaving(true)
    try {
      if (isEdit && subject) {
        await updateSubject({ ...subject, name: trimmed, color })
      } else {
        await addSubject({ name: trimmed, color, order: maxOrder + 1 })
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Subject save failed:', err)
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">{isEdit ? '教科を編集' : '教科を追加'}</h2>

        {/* Name */}
        <div className="field">
          <label className="field-label" htmlFor="subject-name-input">
            教科名
          </label>
          <input
            id="subject-name-input"
            type="text"
            className="field-input"
            placeholder="例：英語"
            value={name}
            maxLength={20}
            autoFocus
            onChange={(e) => { setName(e.target.value); setError('') }}
          />
          {error && <p className="field-error">{error}</p>}
        </div>

        {/* Color */}
        <div className="field">
          <label className="field-label">カラー</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {/* Live preview */}
        <div className="subject-preview">
          <span className="chip chip--selected">
            <span className="chip-dot" style={{ backgroundColor: color }} />
            {name.trim() || '教科名'}
          </span>
        </div>

        <div className="row gap-12 mt-24">
          <button type="button" className="btn btn-outlined flex-1" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-filled flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

interface DeleteDialogProps {
  subject: Subject
  onClose: () => void
  onDeleted: () => void
}

function DeleteDialog({ subject, onClose, onDeleted }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSubject(subject.id)
      onDeleted()
      onClose()
    } catch (err) {
      console.error('Subject delete failed:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="modal-dialog-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-dialog">
        <h3 className="type-title-md mb-8">教科を削除</h3>
        <p className="type-body-md text-secondary mb-24">
          「{subject.name}」を削除しますか？<br />
          この教科の学習記録は残りますが、教科ごとの集計から外れます。
        </p>
        <div className="row gap-12">
          <button type="button" className="btn btn-outlined flex-1" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-danger flex-1"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Subject List Item ─────────────────────────────────────────────────────────

interface SubjectItemProps {
  subject: Subject
  onEdit:   () => void
  onDelete: () => void
}

function SubjectItem({ subject, onEdit, onDelete }: SubjectItemProps) {
  return (
    <div className="subject-item">
      <span className="subject-item-dot" style={{ backgroundColor: subject.color }} />
      <span className="subject-item-name">{subject.name}</span>
      <div className="row gap-4">
        <button
          type="button"
          className="btn btn-icon"
          onClick={onEdit}
          aria-label={`${subject.name}を編集`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-icon text-error"
          onClick={onDelete}
          aria-label={`${subject.name}を削除`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Subjects Screen ───────────────────────────────────────────────────────────

interface SubjectsProps {
  /** Called once when the very first subject is saved (used by App for first-run flow) */
  onFirstSubjectAdded?: () => void
}

export default function Subjects({ onFirstSubjectAdded }: SubjectsProps) {
  const [subjects,        setSubjects]        = useState<Subject[]>([])
  const [loading,         setLoading]         = useState(true)
  const [showAddModal,    setShowAddModal]    = useState(false)
  const [editingSubject,  setEditingSubject]  = useState<Subject | null>(null)
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null)

  const load = useCallback(async () => {
    try {
      const subs = await getSubjects()
      setSubjects(subs)
    } catch (err) {
      console.error('Subjects load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxOrder = subjects.reduce((m, s) => Math.max(m, s.order), 0)

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">教科</h1>
        <p className="screen-subtitle">教科とカラーを管理する</p>
      </div>

      {/* Add button */}
      <button
        type="button"
        className="btn btn-tonal full-w mb-16"
        onClick={() => setShowAddModal(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        教科を追加する
      </button>

      {/* Loading skeletons */}
      {loading && (
        <div className="subject-list">
          {[0, 1, 2].map(i => (
            <div key={i} className="subject-item subject-item--skeleton" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && subjects.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <p className="empty-state-title">教科がありません</p>
          <p className="empty-state-body">上のボタンから教科を追加してください</p>
        </div>
      )}

      {/* Subject list */}
      {!loading && subjects.length > 0 && (
        <div className="subject-list">
          {subjects.map(subject => (
            <SubjectItem
              key={subject.id}
              subject={subject}
              onEdit={()   => setEditingSubject(subject)}
              onDelete={()  => setDeletingSubject(subject)}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <SubjectFormModal
          maxOrder={maxOrder}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            await load()
            // Notify App if this is the very first subject ever added
            if (subjects.length === 0) onFirstSubjectAdded?.()
          }}
        />
      )}

      {/* Edit modal */}
      {editingSubject && (
        <SubjectFormModal
          subject={editingSubject}
          maxOrder={maxOrder}
          onClose={() => setEditingSubject(null)}
          onSaved={load}
        />
      )}

      {/* Delete confirm */}
      {deletingSubject && (
        <DeleteDialog
          subject={deletingSubject}
          onClose={() => setDeletingSubject(null)}
          onDeleted={load}
        />
      )}
    </div>
  )
}