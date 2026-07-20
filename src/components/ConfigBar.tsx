// Save / load named configs + JSON file export/import.

import { useRef, useState } from 'react';
import {
  deleteConfig,
  exportConfigFile,
  importConfigFile,
  listConfigs,
  loadConfig,
  saveConfig,
} from '../state/persistence';
import { Button, Row, Section, SelectField } from './controls';

export function ConfigBar() {
  const [names, setNames] = useState(() => Object.keys(listConfigs()));
  const [current, setCurrent] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setNames(Object.keys(listConfigs()));

  return (
    <Section title="Configurations" defaultOpen={false}>
      <Row label="Saved">
        <SelectField
          value={current}
          options={[['', '— select —'], ...names.map((n) => [n, n] as [string, string])]}
          onChange={(v) => {
            setCurrent(v);
            if (v) loadConfig(v);
          }}
        />
      </Row>
      <div className="hint-row">
        <Button
          variant="primary"
          onClick={() => {
            const name = prompt('Config name', current || 'my-config');
            if (name) {
              saveConfig(name);
              setCurrent(name);
              refresh();
            }
          }}
        >
          Save
        </Button>
        <Button
          variant="danger"
          disabled={!current}
          onClick={() => {
            if (current) {
              deleteConfig(current);
              setCurrent('');
              refresh();
            }
          }}
        >
          Delete
        </Button>
        <Button variant="ghost" onClick={() => exportConfigFile(current || 'config')}>
          Export
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              importConfigFile(f)
                .then(refresh)
                .catch((err: unknown) =>
                  alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
                );
            }
            e.target.value = '';
          }}
        />
      </div>
    </Section>
  );
}
