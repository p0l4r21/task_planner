import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type WorkspaceTab = 'tasks' | 'projects' | 'insights';

interface WorkspaceTabsProps {
  value: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}

const TABS: { value: WorkspaceTab; label: string }[] = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'projects', label: 'Projects' },
  { value: 'insights', label: 'Insights' },
];

export default function WorkspaceTabs({ value, onChange }: WorkspaceTabsProps) {
  return (
    <div className="workspace-tabs">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => { if (v) onChange(v as WorkspaceTab); }}
        className="workspace-tabs-group"
      >
        {TABS.map(tab => (
          <ToggleGroupItem
            key={tab.value}
            value={tab.value}
            className="workspace-tab-item"
          >
            {tab.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
