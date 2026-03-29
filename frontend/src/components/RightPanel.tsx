import { useCallback, useState } from 'react';
import {
  TaskEditor,
  MilestoneEditor,
  ProjectEditor,
  titleForState,
  descriptionForState,
  type PlannerDrawerState,
  type EditorProps,
} from './PlannerDrawer';
import PlannerProjectTree, { type SelectionMode } from './PlannerProjectTree';
import type { Milestone, Project, Task } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';

interface Props extends EditorProps {
  state: PlannerDrawerState | null;
  /** Project workspace fields */
  selectedProject: Project | null;
  selectedProjectId: string | null;
  activeProjects: Project[];
  milestonesByProject: Record<string, Milestone[]>;
  tasks: Task[];
  onSelectProject: (projectId: string) => void;
  onOpenCreateTask: (projectId?: string, parentMilestoneId?: string | null) => void;
  onSetDrawerState: (state: PlannerDrawerState) => void;
  /** Pre-computed project metrics */
  projectProgress: number;
  projectCompletedMilestones: number;
  projectTotalMilestones: number;
  projectTaskCount: number;
  projectNextMilestoneDate: string;
  heroProjectCopy: string;
}

type Panel = 'workspace' | 'editor';

const SELECTION_LABELS: Record<string, string> = {
  'add-sub': 'Select a major milestone as parent',
  'edit': 'Select a milestone to edit',
};

export default function RightPanel({
  state,
  selectedProject,
  selectedProjectId,
  activeProjects,
  milestonesByProject,
  tasks,
  onSelectProject,
  onOpenCreateTask,
  onSetDrawerState,
  projectProgress,
  projectCompletedMilestones,
  projectTotalMilestones,
  projectTaskCount,
  projectNextMilestoneDate,
  heroProjectCopy,
  ...editorProps
}: Props) {
  const panel: Panel = state ? 'editor' : 'workspace';
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [projectCollapsed, setProjectCollapsed] = useState(false);
  const isCreateMode = state?.type.endsWith('-create') ?? false;

  const handleMilestoneSelected = useCallback((milestone: Milestone) => {
    if (!selectionMode || !selectedProjectId) return;

    if (selectionMode.type === 'edit') {
      onSetDrawerState({ type: 'milestone-edit', milestone });
    } else if (selectionMode.type === 'add-sub') {
      onSetDrawerState({ type: 'milestone-create', projectId: selectedProjectId, parentMilestoneId: milestone.id });
    }
    setSelectionMode(null);
  }, [selectionMode, selectedProjectId, onSetDrawerState]);

  const handleAddMajor = () => {
    if (!selectedProjectId) return;
    onSetDrawerState({ type: 'milestone-create', projectId: selectedProjectId, parentMilestoneId: null });
    setSelectionMode(null);
  };

  const handleAddSub = () => {
    setSelectionMode({ type: 'add-sub' });
  };

  const handleEditMode = () => {
    setSelectionMode({ type: 'edit' });
  };

  const cancelSelection = () => {
    setSelectionMode(null);
  };

  return (
    <aside className="right-panel">
      <Tabs value={panel} className="flex flex-col h-full">
        <TabsList variant="line" className="w-full rounded-none border-b border-border/30 h-auto p-0">
          <TabsTrigger
            value="workspace"
            className="flex-1 rounded-none px-3 py-2 text-xs font-semibold"
            onClick={() => { editorProps.onClose(); setSelectionMode(null); }}
          >
            Workspace
          </TabsTrigger>
          <TabsTrigger
            value="editor"
            className="flex-1 rounded-none px-3 py-2 text-xs font-semibold"
            disabled={!state}
          >
            {state ? titleForState(state) : 'Editor'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="right-panel-tab-content right-panel-editor-tab">
          {state && (
            <div className="right-panel-editor-shell">
              <div className="right-panel-editor-header">
                {isCreateMode ? (
                  <div className="create-type-selector">
                    <span className="create-type-label">Create</span>
                    <div className="create-type-pills" role="tablist" aria-label="Create item type">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`create-type-pill${state.type === 'task-create' ? ' active' : ''}`}
                        onClick={() => onSetDrawerState({ type: 'task-create', defaults: { project_id: selectedProjectId || undefined } })}
                      >
                        Task
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`create-type-pill${state.type === 'milestone-create' ? ' active' : ''}`}
                        onClick={() => onSetDrawerState({ type: 'milestone-create', projectId: selectedProjectId || editorProps.projects[0]?.id || '', parentMilestoneId: null })}
                      >
                        Milestone
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`create-type-pill${state.type === 'project-create' ? ' active' : ''}`}
                        onClick={() => onSetDrawerState({ type: 'project-create' })}
                      >
                        Project
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="right-panel-editor-heading">
                    <span className="planner-drawer-kicker">Workspace editor</span>
                    <h3>{titleForState(state)}</h3>
                    <p className="planner-drawer-subtitle">{descriptionForState(state)}</p>
                  </div>
                )}
              </div>
              <div className="right-panel-editor-form">
                {(state.type === 'task-create' || state.type === 'task-edit') && (
                  <TaskEditor
                    state={state}
                    projects={editorProps.projects}
                    milestonesByProject={milestonesByProject}
                    onClose={editorProps.onClose}
                    onCreateTask={editorProps.onCreateTask}
                    onUpdateTask={editorProps.onUpdateTask}
                  />
                )}
                {(state.type === 'project-create' || state.type === 'project-edit') && (
                  <ProjectEditor
                    state={state}
                    onClose={editorProps.onClose}
                    onCreateProject={editorProps.onCreateProject}
                    onUpdateProject={editorProps.onUpdateProject}
                  />
                )}
                {(state.type === 'milestone-create' || state.type === 'milestone-edit') && (
                  <MilestoneEditor
                    state={state}
                    projects={editorProps.projects}
                    milestonesByProject={milestonesByProject}
                    onClose={editorProps.onClose}
                    onCreateMilestone={editorProps.onCreateMilestone}
                    onUpdateMilestone={editorProps.onUpdateMilestone}
                  />
                )}
              </div>
            </div>
          )}
        </TabsContent>

          <TabsContent value="workspace" className="right-panel-tab-content right-panel-workspace-tab">
            <div className="right-panel-workspace">
            {/* Project header */}
            <button
              className="right-panel-project-header"
              type="button"
              onClick={() => setProjectCollapsed(prev => !prev)}
            >
              <div className="right-panel-project-header-left">
                <strong>{selectedProject?.name || 'Portfolio overview'}</strong>
                {selectedProject && (
                  <span className={`planner-project-status planner-project-status-${selectedProject.status}`}>
                    {selectedProject.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <span className="planner-project-toggle">{projectCollapsed ? '+' : '−'}</span>
            </button>

            {!projectCollapsed && (
              <>
            {/* Metrics row */}
            <div className="right-panel-metrics">
              <div className="right-panel-metric">
                <span>Milestones</span>
                <strong>{projectCompletedMilestones}/{projectTotalMilestones}</strong>
              </div>
              <div className="right-panel-metric">
                <span>Tasks</span>
                <strong>{projectTaskCount}</strong>
              </div>
              <div className="right-panel-metric">
                <span>Next target</span>
                <strong>{projectNextMilestoneDate}</strong>
              </div>
            </div>

            {/* Progress bar */}
            <div className="right-panel-progress-row">
              <Progress value={projectProgress} className="h-2 flex-1" />
              <span>{projectProgress}% mapped</span>
            </div>

            {/* Project pills (when multiple) */}
            {activeProjects.length > 1 && (
              <div className="right-panel-project-pills">
                {activeProjects.map(project => (
                  <button
                    key={project.id}
                    type="button"
                    className={`planner-project-pill${selectedProjectId === project.id ? ' active' : ''}`}
                    onClick={() => onSelectProject(project.id)}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            )}

            {/* Control bar */}
            {selectedProject && (
              <div className="right-panel-controls">
                <Button
                  className="right-panel-control-button"
                  variant="outline"
                  size="xs"
                  onClick={() => onOpenCreateTask(selectedProject.id, null)}
                  disabled={selectionMode !== null}
                >
                  + Task
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="right-panel-control-button"
                      variant="outline"
                      size="xs"
                      disabled={selectionMode !== null}
                    >
                      Add ▾
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={handleAddMajor}>Major Milestone</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddSub}>Sub Milestone…</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  className={`right-panel-control-button${selectionMode?.type === 'edit' ? ' active' : ''}`}
                  variant="outline"
                  size="xs"
                  onClick={selectionMode?.type === 'edit' ? cancelSelection : handleEditMode}
                  disabled={selectionMode !== null && selectionMode.type !== 'edit'}
                >
                  Edit
                </Button>
              </div>
            )}

            {/* Selection mode banner */}
            {selectionMode && (
              <div className="right-panel-selection-banner">
                <span>{SELECTION_LABELS[selectionMode.type]}</span>
                <Button variant="outline" size="xs" onClick={cancelSelection}>Cancel</Button>
              </div>
            )}

            {/* Edit project card (shown in edit mode) */}
            {selectionMode?.type === 'edit' && selectedProject && (
              <Card
                className="cursor-pointer text-sm text-muted-foreground hover:bg-primary/10 hover:ring-primary/25 transition-colors"
                size="sm"
                onClick={() => {
                  onSetDrawerState({ type: 'project-edit', project: selectedProject });
                  setSelectionMode(null);
                }}
              >
                <div className="px-3 py-1.5">To edit project, click here</div>
              </Card>
            )}

            {/* Project tree */}
            <div className="right-panel-tree">
              <PlannerProjectTree
                projects={selectedProject ? [selectedProject] : []}
                milestonesByProject={milestonesByProject}
                tasks={tasks}
                selectedProjectId={selectedProjectId}
                onSelectProject={onSelectProject}
                onCreateTask={onOpenCreateTask}
                onCreateMilestone={(projectId, parentMilestoneId) =>
                  onSetDrawerState({ type: 'milestone-create', projectId, parentMilestoneId })
                }
                onEditProject={project => onSetDrawerState({ type: 'project-edit', project })}
                onEditMilestone={milestone => onSetDrawerState({ type: 'milestone-edit', milestone })}
                selectionMode={selectionMode}
                onMilestoneSelected={handleMilestoneSelected}
                variant="tree-only"
              />
            </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
