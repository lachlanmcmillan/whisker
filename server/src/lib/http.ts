const corsOrigin = process.env.DEPLOY_CORS_ORIGIN ?? "*";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function json(data: any, status = 200) {
  return Response.json(data, {
    status,
    headers: corsHeaders(),
  });
}

export function errorStatus(code: string): number {
  if (code === "invalid_input") return 400;
  if (code === "feed_not_found") return 404;
  if (code === "entry_not_found") return 404;
  if (code === "tag_not_found") return 404;
  if (code === "tag_conflict") return 409;
  if (code === "unauthorized") return 401;
  return 500;
}
