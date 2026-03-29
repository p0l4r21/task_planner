import { Button } from '@/components/ui/button';

export type PlannerLane = 'overdue' | 'today' | 'this_week' | 'later';

interface Props {
  weekRangeLabel: string;
  weekOffset: number;
  onChangeWeek: (offset: number) => void;
  onCreate: () => void;
  filterSearch: string;
  onFilterChange: (patch: { search?: string; priority?: string; projectId?: string }) => void;
}

export default function WeekBar({
  weekRangeLabel,
  weekOffset,
  onChangeWeek,
  onCreate,
  filterSearch,
  onFilterChange,
}: Props) {
  return (
    <header className="week-bar">
      <div className="week-bar-board">
        <div className="week-bar-nav">
          <button className="week-bar-chevron" onClick={() => onChangeWeek(weekOffset - 1)} aria-label="Previous week">‹</button>
          <span className="week-bar-range">{weekRangeLabel}</span>
          <button className="week-bar-chevron" onClick={() => onChangeWeek(weekOffset + 1)} aria-label="Next week">›</button>
        </div>
        {weekOffset !== 0 && (
          <button className="week-bar-chevron week-bar-return" onClick={() => onChangeWeek(0)} aria-label="Return to current week" title="Return to current week">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
        )}
        <input
          type="search"
          placeholder="Search…"
          className="week-bar-search"
          value={filterSearch}
          onChange={e => onFilterChange({ search: e.target.value })}
        />
      </div>

      <div className="week-bar-workspace">
        <Button className="week-bar-create-button" variant="outline" size="sm" onClick={onCreate}>+ Create</Button>
      </div>
    </header>
  );
}
