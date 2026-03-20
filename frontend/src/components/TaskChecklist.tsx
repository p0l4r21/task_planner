import { useState } from 'react';
import type { ChecklistItem } from '../types';

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}

let _nextId = Date.now();
function uid() { return String(++_nextId); }

export function parseChecklist(raw: string): ChecklistItem[] {
  if (!raw || !raw.trim()) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items.length ? JSON.stringify(items) : '';
}

export default function TaskChecklist({ items, onChange, readOnly }: Props) {
  const [newText, setNewText] = useState('');

  const toggle = (id: string) => {
    onChange(items.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  };

  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, { id: uid(), text: newText.trim(), completed: false }]);
    setNewText('');
  };

  const removeItem = (id: string) => {
    onChange(items.filter(i => i.id !== id));
  };

  const updateText = (id: string, text: string) => {
    onChange(items.map(i => i.id === id ? { ...i, text } : i));
  };

  const total = items.length;
  const done = items.filter(i => i.completed).length;

  return (
    <div className="checklist">
      {total > 0 && (
        <div className="checklist-progress">
          <div className="checklist-progress-bar">
            <div className="checklist-progress-fill" style={{ width: `${total ? (done / total * 100) : 0}%` }} />
          </div>
          <span className="checklist-progress-text">{done}/{total}</span>
        </div>
      )}
      <ul className="checklist-list">
        {items.map(item => (
          <li key={item.id} className={`checklist-item${item.completed ? ' checklist-done' : ''}`}>
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggle(item.id)}
              disabled={readOnly}
              title="Toggle checklist item"
            />
            {readOnly ? (
              <span className="checklist-text">{item.text}</span>
            ) : (
              <input
                type="text"
                className="checklist-text-input"
                value={item.text}
                onChange={e => updateText(item.id, e.target.value)}
                title="Checklist item text"
              />
            )}
            {!readOnly && (
              <button className="btn btn-xs btn-danger checklist-remove" onClick={() => removeItem(item.id)}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="checklist-add">
          <input
            type="text"
            placeholder="Add checklist item…"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={addItem} disabled={!newText.trim()}>+</button>
        </div>
      )}
    </div>
  );
}
