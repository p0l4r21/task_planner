import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getAIConfig, setAIConfig, isAIConfigured,
  getModelRegistry, refreshModelRegistry, isModelValid,
  BUCKET_META,
  type CuratedModel, type CurationResult, type ModelBucket,
} from '../lib/ai';

export default function SettingsPage() {
  const config = getAIConfig();
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [saved, setSaved] = useState(false);
  const [registry, setRegistry] = useState<CurationResult | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customOverride, setCustomOverride] = useState(false);
  const [customModelId, setCustomModelId] = useState('');

  const loadRegistry = useCallback(async (forceRefresh = false) => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const result = forceRefresh
        ? await refreshModelRegistry()
        : await getModelRegistry();
      setRegistry(result);
      // Warn if saved model no longer exists
      if (model && result.compatible.length > 0 && !result.compatible.some(m => m.id === model)) {
        setModelsError(`Previously saved model "${model}" was not found — pick a new one`);
      }
    } catch {
      setModelsError('Could not fetch models — showing defaults');
    } finally {
      setModelsLoading(false);
    }
  }, [model]);

  useEffect(() => {
    loadRegistry();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveAI = () => {
    const selectedModel = customOverride && customModelId.trim() ? customModelId.trim() : model;
    setAIConfig(apiKey, selectedModel);
    setModel(selectedModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    loadRegistry(true);
  };

  const recommended = registry?.recommended ?? [];
  const compatible = registry?.compatible ?? [];

  // Determine what to show in the selector
  const selectorModels: CuratedModel[] = showAdvanced ? compatible : recommended;

  // Check if current model is a known one
  const modelValidated = !model || isModelValid(model);

  return (
    <div className="page">
      <h2>Settings</h2>

      {/* AI Configuration */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AI Integration
            {isAIConfigured() && <span className="text-xs font-normal text-green-500">● Connected</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect an OpenAI-compatible API to unlock AI-powered insights, idea summarization, tag suggestions, and project scope drafting.
          </p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="max-w-md"
            />
          </div>

          {/* Model selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Model</label>
            {!customOverride && (
              <div className="flex items-center gap-2">
                <Select value={model} onValueChange={setModel} disabled={customOverride}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {!showAdvanced && recommended.length > 0 && (
                      <>
                        {recommended.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{m.label}</span>
                              {m.bucket && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {BUCKET_META[m.bucket as ModelBucket].label}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {showAdvanced && compatible.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <span>{m.id}</span>
                          {m.bucket && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {BUCKET_META[m.bucket as ModelBucket].label}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                    {selectorModels.length === 0 && (
                      <SelectItem value={model || 'gpt-5.4'} disabled>
                        No models discovered
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!apiKey || modelsLoading}
                  onClick={() => loadRegistry(true)}
                >
                  {modelsLoading ? 'Loading…' : '↻'}
                </Button>
              </div>
            )}

            {/* Description for selected model */}
            {!customOverride && (() => {
              const sel = [...recommended, ...compatible].find(m => m.id === model);
              return sel?.description ? (
                <p className="text-xs text-muted-foreground mt-1">{sel.description}</p>
              ) : null;
            })()}

            {/* Custom override input */}
            {customOverride && (
              <Input
                value={customModelId}
                onChange={e => setCustomModelId(e.target.value)}
                placeholder="e.g. gpt-5.4-preview"
                className="max-w-xs mt-1"
              />
            )}

            {modelsError && <p className="text-xs text-yellow-500 mt-1">{modelsError}</p>}
            {!modelValidated && !customOverride && (
              <p className="text-xs text-yellow-500 mt-1">
                ⚠ Model "{model}" not found in discovered models
              </p>
            )}

            {/* Toggle row */}
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={showAdvanced}
                  onCheckedChange={v => setShowAdvanced(v === true)}
                  className="h-3.5 w-3.5"
                />
                All compatible models
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={customOverride}
                  onCheckedChange={v => setCustomOverride(v === true)}
                  className="h-3.5 w-3.5"
                />
                Custom model ID
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveAI}>Save</Button>
            {saved && <span className="text-xs text-green-500">Saved!</span>}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Task Planner v1.0 — Local-first task management for operational work.</p>
          <p>Data is stored in a PostgreSQL database.</p>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Planned Enhancements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-6 space-y-1">
            <li>Recurring tasks</li>
            <li>Weekly report generation</li>
            <li>Planner / Graph API sync</li>
            <li>Task dependencies</li>
            <li>Email/task ingestion</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
