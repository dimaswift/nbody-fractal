// Named configuration save/load (localStorage) + JSON file export/import.
// Schema v3: field + volumes (v2 configs with sampling/shading still load).

import type { FieldParams, SamplingParams } from '../engine/types';
import {
  defaultField,
  defaultSampling,
  defaultShading,
  defaultVolume,
  useStore,
  type ShadingParams,
  type Volume,
} from './store';

const LS_KEY = 'nbody-fractal-studio-configs-v2';

export interface StudioConfig {
  version: 2 | 3;
  name: string;
  savedAt: string;
  field: FieldParams;
  volumes?: Volume[];
  // legacy v2 single-sampler fields
  sampling?: SamplingParams;
  shading?: ShadingParams;
}

export function currentConfig(name: string): StudioConfig {
  const s = useStore.getState();
  return {
    version: 3,
    name,
    savedAt: new Date().toISOString(),
    field: structuredClone(s.field),
    volumes: structuredClone(s.volumes),
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
  const field = { ...defaultField(), ...cfg.field };
  if ((cfg.field as Partial<typeof field>).bodyInitMode === undefined) {
    field.bodyInitMode = 0;
  }
  // Operators moved from field to per-volume; drop any legacy field.operators.
  delete (field as { operators?: unknown }).operators;

  const fieldNonce = useStore.getState().fieldNonce + 1;

  let volumes: Volume[];
  if (cfg.volumes && cfg.volumes.length > 0) {
    volumes = cfg.volumes.map((v) => ({
      ...defaultVolume(v.name),
      ...v,
      sampling: { ...defaultSampling(), ...v.sampling },
      shading: { ...defaultShading(), ...v.shading },
      conformedNonce: fieldNonce, // fresh relative to the loaded field
    }));
  } else {
    // legacy v2: build a single volume from the config's sampling+shading,
    // migrating any operators that lived on the field.
    const base = defaultVolume('Volume 1');
    const legacyOps = (cfg.field as { operators?: SamplingParams['operators'] }).operators;
    volumes = [
      {
        ...base,
        sampling: {
          ...defaultSampling(),
          ...cfg.sampling,
          operators: legacyOps ?? cfg.sampling?.operators ?? defaultSampling().operators,
        },
        shading: { ...defaultShading(), ...cfg.shading },
        conformedNonce: fieldNonce,
      },
    ];
  }

  store.set({ field, fieldNonce, volumes, activeVolumeId: volumes[0].id, selection: { kind: 'none' } });
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
