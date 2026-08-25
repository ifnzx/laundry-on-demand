import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, details },
    { status }
  );
}

export function jsonUnauthorized(message = "Unauthorized") {
  return jsonError(message, 401);
}

export function jsonForbidden(message = "Forbidden") {
  return jsonError(message, 403);
}

export function jsonNotFound(message = "Not found") {
  return jsonError(message, 404);
}

export function jsonValidation(message: string, details?: unknown) {
  return jsonError(message, 422, details);
}
