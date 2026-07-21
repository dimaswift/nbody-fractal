// Boolean geometry operators — ordered list, gizmo-selectable.

import { OpType, ShapeType } from '../engine/types';
import { useStore } from '../state/store';
import { Button, NumberField, Row, Section, SelectField, Slider } from './controls';

const SHAPE_OPTIONS: [number, string][] = [
  [ShapeType.Sphere, 'Sphere'],
  [ShapeType.Box, 'Box'],
  [ShapeType.ChamferBox, 'Chamfer box'],
  [ShapeType.Cylinder, 'Cylinder'],
  [ShapeType.Capsule, 'Capsule'],
  [ShapeType.Slab, 'Slab'],
];

const OP_OPTIONS: [number, string][] = [
  [OpType.Intersect, 'Intersect (keep inside)'],
  [OpType.Subtract, 'Subtract (carve)'],
  [OpType.Union, 'Union (restore)'],
];

export function OperatorsPanel() {
  const operators = useStore((s) => s.field.operators);
  const selection = useStore((s) => s.selection);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const set = useStore((s) => s.set);
  const select = useStore((s) => s.select);
  const addOperator = useStore((s) => s.addOperator);
  const updateOperator = useStore((s) => s.updateOperator);
  const removeOperator = useStore((s) => s.removeOperator);
  const showOperators = useStore((s) => s.showOperators);

  return (
    <Section title={`Boolean operators (${operators.length}/8)`}>
      <div className="hint-row">
        <Button onClick={() => addOperator()} variant="primary" disabled={operators.length >= 8}>
          + Add operator
        </Button>
        <Button variant="ghost" onClick={() => set({ showOperators: !showOperators })}>
          {showOperators ? 'Hide shapes' : 'Show shapes'}
        </Button>
      </div>
      <div className="seg">
        {(['translate', 'rotate', 'scale'] as const).map((m) => (
          <button key={m} className={gizmoMode === m ? 'seg-on' : ''} onClick={() => set({ gizmoMode: m })}>
            {m === 'translate' ? 'Move (W)' : m === 'rotate' ? 'Rotate (E)' : 'Scale (R)'}
          </button>
        ))}
      </div>

      {operators.map((op) => {
        const selected = selection.kind === 'operator' && selection.id === op.id;
        return (
          <div
            key={op.id}
            className={`card ${selected ? 'card-selected' : ''}`}
            onClick={() => select({ kind: 'operator', id: op.id })}
          >
            <div className="card-head">
              <input
                type="checkbox"
                checked={op.enabled}
                title="Enabled"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateOperator(op.id, { enabled: e.target.checked })}
              />
              <span className="card-title">{op.name}</span>
              <Button
                variant="danger"
                onClick={() => removeOperator(op.id)}
                title="Remove operator"
              >
                ✕
              </Button>
            </div>
            <Row label="Shape">
              <SelectField
                value={op.shapeType}
                options={SHAPE_OPTIONS}
                onChange={(v) => updateOperator(op.id, { shapeType: v })}
              />
            </Row>
            <Row label="Operation">
              <SelectField
                value={op.opType}
                options={OP_OPTIONS}
                onChange={(v) => updateOperator(op.id, { opType: v })}
              />
            </Row>
            <Slider
              label="Size"
              value={op.size}
              min={0.05}
              max={4}
              step={0.01}
              onChange={(v) => updateOperator(op.id, { size: v })}
            />
            <Slider
              label="Falloff"
              value={op.falloff}
              min={0.005}
              max={1}
              step={0.005}
              onChange={(v) => updateOperator(op.id, { falloff: v })}
            />
            <Row label="Pos X/Y/Z">
              <NumberField value={op.position[0]} width={52} onChange={(v) => updateOperator(op.id, { position: [v, op.position[1], op.position[2]] })} />
              <NumberField value={op.position[1]} width={52} onChange={(v) => updateOperator(op.id, { position: [op.position[0], v, op.position[2]] })} />
              <NumberField value={op.position[2]} width={52} onChange={(v) => updateOperator(op.id, { position: [op.position[0], op.position[1], v] })} />
              <Button
                variant="ghost"
                title="Reset position to origin"
                onClick={() => updateOperator(op.id, { position: [0, 0, 0] })}
              >
                ⊙
              </Button>
            </Row>
          </div>
        );
      })}
      <span className="hint">
        Operators apply in list order. Select one to move / rotate / scale it with the viewport gizmo — the
        surface re-extracts live.
      </span>
    </Section>
  );
}
