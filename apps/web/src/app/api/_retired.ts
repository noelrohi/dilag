import { NextResponse } from "next/server";

export function retired() {
  return NextResponse.json(
    { error: "gone", message: "This endpoint has been retired." },
    { status: 410 }
  );
}
