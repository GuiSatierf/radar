import { getAuth } from "@/lib/auth";

// The auth instance is created on the first request, so `next build` needs no secrets.
export async function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
