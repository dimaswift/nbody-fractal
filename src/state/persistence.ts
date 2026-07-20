// Named configuration save/load (localStorage) + JSON file export/import.
// Schema v2 — not compatible with the legacy explorer's configs.

import type { FieldParams, SamplingParams } from '../engine/types';
import { defaultField, defaultSampling, defaultShading, useStore, type ShadingParams } from './store';

const LS_KEY = 'nbody-fractal-studio-configs-v2';

export interface StudioConfig {
  version: 2;
  name: string;
  savedAt: string;
  field: FieldParams;
  sampling: SamplingParams;
  shading: ShadingParams;
}

export function currentConfig(name: string): StudioConfig {
  const s = useStore.getState();
  return {
    version: 2,
    name,
    savedAt: new Date().toISOString(),
    field: structuredClone(s.field),
    sampling: structuredClone(s.sampling),
    shading: structuredClone(s.shading),
  };
}

export function listConfigs(): Record<string, StudioConfig> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Record<string, StudioConfig>;
  } catch {
    return {};
  }
}

export function saveConfig(name: string) {
  const all = listConfigs();
  all[name] = currentConfig(name);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function deleteConfig(name: string) {
  const all = listConfigs();
  delete all[name];
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

export function applyConfig(cfg: StudioConfig) {
  const store = useStore.getState();
  // Merge over defaults so configs stay loadable when fields are added later
  store.set({
    field: { ...defaultField(), ...cfg.field },
    sampling: { ...defaultSampling(), ...cfg.sampling },
    shading: { ...defaultShading(), ...cfg.shading },
    selection: { kind: 'none' },
  });
  store.requestExtract();
}

export function loadConfig(name: string): boolean {
  const cfg = listConfigs()[name];
  if (!cfg) return false;
  applyConfig(cfg);
  return true;
}

export function exportConfigFile(name = 'config') {
  const cfg = currentConfig(name);
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `nbody-studio-${name}-${Date.now()}.json`);
}

export async function importConfigFile(file: File): Promise<void> {
  const text = await file.text();
  const cfg = JSON.parse(text) as StudioConfig;
  if (cfg.version !== 2) {
    throw new Error(`Unsupported config version: ${String(cfg.version)} (expected 2)`);
  }
  applyConfig(cfg);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
