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
  const [selected, setSelected] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setNames(Object.keys(listConfigs()));
  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const doSave = () => {
    const name = nameInput.trim() || selected || 'untitled';
    try {
      saveConfig(name);
      refresh();
      setSelected(name);
      setNameInput('');
      flash(`saved “${name}”`);
    } catch (err) {
      flash(`save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <Section title="Configurations" defaultOpen={false}>
      <div className="hint-row">
        <input
          className="num"
          style={{ flex: 1, width: 'auto' }}
          type="text"
          placeholder="config name…"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSave();
          }}
        />
        <Button variant="primary" onClick={doSave}>
          Save
        </Button>
      </div>
      <Row label="Saved">
        <SelectField
          value={selected}
          options={[['', '— select —'], ...names.map((n) => [n, n] as [string, string])]}
          onChange={setSelected}
        />
      </Row>
      <div className="hint-row">
        <Button
          variant="primary"
          disabled={!selected}
          onClick={() => {
            if (selected && loadConfig(selected)) flash(`loaded “${selected}”`);
            else flash('load failed');
          }}
        >
          Load
        </Button>
        <Button
          variant="danger"
          disabled={!selected}
          onClick={() => {
            deleteConfig(selected);
            setSelected('');
            refresh();
            flash('deleted');
          }}
        >
          Delete
        </Button>
        <Button variant="ghost" onClick={() => exportConfigFile(selected || nameInput.trim() || 'config')}>
          Export
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              importConfigFile(f)
                .then(() => {
                  refresh();
                  flash('imported');
                })
                .catch((err: unknown) =>
                  flash(`import failed: ${err instanceof Error ? err.message : String(err)}`)
                );
            }
            e.target.value = '';
          }}
        />
      </div>
      {status && <span className="hint">{status}</span>}
    </Section>
  );
}
