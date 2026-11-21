import { z } from "zod";

/**
 * A schema for PARTIAL UPDATES of a record: every field optional, and a
 * field that is not sent stays absent from the result.
 *
 * Use this instead of `schema.partial()` for update (PUT / PATCH) routes.
 * In zod 4, `partial()` keeps each field's `.default(...)`, so a field the
 * caller did not send comes back filled with its default. For an update
 * that means "edit the status of this disease case" would also write
 * `additionalConditions: []` and erase what was recorded. Defaults belong
 * to creating a record, not to editing one.
 *
 * tests/patch.test.ts checks every insert schema in shared/schema.ts.
 */
export function patchSchema<S extends z.ZodObject>(schema: S): ReturnType<S["partial"]> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    shape[key] = withoutDefault(field).optional();
  }
  return z.object(shape) as unknown as ReturnType<S["partial"]>;
}

/** The same field type with any `.default()` / `.prefault()` wrapper removed. */
function withoutDefault(field: z.ZodType): z.ZodType {
  if (field instanceof z.ZodDefault || field instanceof z.ZodPrefault) {
    return withoutDefault(field.unwrap() as z.ZodType);
  }
  if (field instanceof z.ZodOptional) {
    return withoutDefault(field.unwrap() as z.ZodType).optional();
  }
  if (field instanceof z.ZodNullable) {
    return withoutDefault(field.unwrap() as z.ZodType).nullable();
  }
  return field;
}
