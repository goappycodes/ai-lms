import { NextResponse } from "next/server";
import type { ZodTypeAny, output } from "zod";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
export function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
export function notFound(error = "Not found") {
  return NextResponse.json({ error }, { status: 404 });
}
export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

// Parse + validate a JSON body against a zod schema.
//
// Generic over the schema rather than over one type: ZodSchema<T> ties the
// input and output types together, so a schema using .default() or .transform()
// silently degraded to a looser type and every field came back possibly
// undefined. output<S> is what the schema actually produces.
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ data: output<S> } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return { error: bad(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")) };
  }
  return { data: result.data };
}
