import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) return jsonError(e.status, e.message);
  console.error("[api]", e);
  return jsonError(500, "Something went wrong. Please try again.");
}
