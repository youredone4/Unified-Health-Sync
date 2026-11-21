import { zodResolver as baseZodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * zodResolver, typed by what the schema PRODUCES.
 *
 * Forms here are declared as `useForm<z.infer<typeof schema>>`, i.e. by
 * the schema's output type. With zod 4 the stock resolver is typed by the
 * schema's INPUT type instead, which differs wherever a schema coerces
 * (`z.coerce.number()` accepts `unknown`), and every such form stops
 * type-checking. This wrapper is the one place that says "the form holds
 * the parsed shape"; behaviour is exactly the stock resolver's.
 */
export function zodResolver<Schema extends z.ZodType>(
  schema: Schema,
): Resolver<z.output<Schema> & FieldValues> {
  return baseZodResolver(schema as never) as unknown as Resolver<z.output<Schema> & FieldValues>;
}
