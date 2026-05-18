/**
 * Boolean operation latency, varying number of operands and operation type.
 *
 * `booleanOp` is destructive on `objectsMap` (it removes the operand entries
 * and adds the result entry). For benchmarking we re-create the operand
 * elements on every run by deep-copying the BRep / occBrep payloads — the
 * worker request serialises to JSON anyway, so the inputs are conceptually
 * pure values once they leave the main thread.
 */

import * as THREE from "three";
import {
  booleanOp,
  nodeId,
  type BooleanOperation,
  type SceneElement,
} from "@vitekk02/cadjs";
import type { BenchScenario } from "../timing";
import { makeBoxElement } from "../fixtures";

interface BoolFixture {
  template: SceneElement[];
}

/**
 * Build N boxes of side `side` arranged in a stagger pattern so each pair
 * intersects but the overall union is a non-trivial shape (each box overlaps
 * its predecessor by half its side along x, then alternates +y/-y).
 */
async function buildBoxStagger(n: number, side = 100): Promise<SceneElement[]> {
  const elements: SceneElement[] = [];
  for (let i = 0; i < n; i++) {
    const offsetX = i * (side * 0.5);
    const offsetY = (i % 2 === 0 ? 1 : -1) * (side * 0.25);
    elements.push(
      await makeBoxElement({
        width: side,
        height: side,
        depth: side,
        position: { x: offsetX, y: offsetY, z: 0 },
      }),
    );
  }
  return elements;
}

/** Clone the SceneElement array enough that booleanOp can consume it. */
function cloneTemplate(template: SceneElement[]): {
  elements: SceneElement[];
  ids: string[];
  objectsMap: Map<string, THREE.Object3D>;
} {
  const elements = template.map((t) => ({
    brep: t.brep, // Brep is consumed read-only by toJSON()
    nodeId: nodeId(t.nodeId), // re-mint to keep brand
    position: t.position.clone(),
    occBrep: t.occBrep,
  }));
  const ids = elements.map((e) => e.nodeId);
  const objectsMap = new Map<string, THREE.Object3D>();
  for (const e of elements) {
    objectsMap.set(e.nodeId, new THREE.Group());
  }
  return { elements, ids, objectsMap };
}

function makeBoolScenario(op: BooleanOperation, n: number): BenchScenario {
  const opLabel = op.padEnd(13);
  return {
    name: `boolean / ${opLabel} N=${n}`,
    group: "boolean",
    description: `${op} on ${n} staggered boxes (side=100mm).`,
    setup: async (): Promise<BoolFixture> => ({
      template: await buildBoxStagger(n),
    }),
    run: async (ctx) => {
      const { template } = ctx as BoolFixture;
      const { elements, ids, objectsMap } = cloneTemplate(template);
      const result = await booleanOp(op, elements, ids, 100, objectsMap);
      if (!result.ok) {
        throw new Error(`booleanOp ${op} failed: ${result.reason}`);
      }
    },
    n: 15,
    warmups: 1,
  };
}

export const booleanScenarios: BenchScenario[] = [
  makeBoolScenario("union", 2),
  makeBoolScenario("union", 4),
  makeBoolScenario("union", 6),
  makeBoolScenario("difference", 2),
  makeBoolScenario("intersection", 2),
];
