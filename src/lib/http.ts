export const jsonOk = (data: unknown, init?: ResponseInit) =>
  Response.json(data, { status: 200, ...(init ?? {}) });

export const jsonError = (message: string, status = 400) =>
  Response.json({ error: message }, { status });
