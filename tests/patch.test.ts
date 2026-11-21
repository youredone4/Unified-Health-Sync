/**
 * Unit tests for shared/patch.ts. No server or database needed:
 *
 *   npm run test:unit
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import * as schema from "../shared/schema";
import { api } from "../shared/routes";
import { patchSchema } from "../shared/patch";

test("a field that is not sent is not written", () => {
  const record = z.object({
    name: z.string(),
    tags: z.array(z.string()).default([]),
    notes: z.string().optional().default(""),
    score: z.number().nullable().default(null),
    status: z.string().default("NEW").optional(),
  });
  // What zod 4's own partial() does, and why it must not be used for updates:
  assert.deepEqual(record.partial().parse({}), { tags: [], notes: "", score: null, status: "NEW" });
  // What an update needs:
  assert.deepEqual(patchSchema(record).parse({}), {});
  assert.deepEqual(patchSchema(record).parse({ name: "x" }), { name: "x" });
});

test("fields that are sent are still validated and kept", () => {
  const record = z.object({ name: z.string().min(2), tags: z.array(z.string()).default([]), score: z.number().nullable().default(null) });
  const patch = patchSchema(record);
  assert.deepEqual(patch.parse({ tags: ["a"], score: null }), { tags: ["a"], score: null });
  assert.equal(patch.safeParse({ name: "x" }).success, false, "min length still applies");
  assert.equal(patch.safeParse({ tags: "not-an-array" }).success, false);
  assert.deepEqual(patch.parse({ unknownField: 1 }), {}, "unknown fields are dropped");
});

test("no insert schema in shared/schema.ts injects a value into an empty update", () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const [name, value] of Object.entries(schema)) {
    if (!/^insert.*Schema$/.test(name) || !(value instanceof z.ZodObject)) continue;
    checked++;
    const result = patchSchema(value).safeParse({});
    if (!result.success || Object.keys(result.data as object).length > 0) {
      offenders.push(`${name} -> ${JSON.stringify(result.success ? result.data : result.error.issues[0])}`);
    }
  }
  assert.ok(checked > 40, `only found ${checked} insert schemas; the scan is probably broken`);
  assert.deepEqual(offenders, []);
});

test("every update route's input schema leaves unsent fields alone", () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const [resource, routes] of Object.entries(api as Record<string, any>)) {
    const input = routes?.update?.input;
    if (!input) continue;
    checked++;
    const result = input.safeParse({});
    if (!result.success || Object.keys(result.data).length > 0) {
      offenders.push(`${resource}.update -> ${JSON.stringify(result.success ? result.data : result.error.issues[0])}`);
    }
  }
  assert.ok(checked >= 7, `only found ${checked} update routes`);
  assert.deepEqual(offenders, []);
});
