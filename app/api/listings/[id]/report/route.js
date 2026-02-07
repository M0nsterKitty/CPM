import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { reportListing } from "../../../../../lib/store";

export async function POST(request, { params }) {
  const userId = cookies().get("uid")?.value;
  if (!userId) {
    return NextResponse.json(
      { message: "User session not available." },
      { status: 400 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const reason = body.reason?.trim();
  const listing = await reportListing({
    listingId: params.id,
    userId,
    reason
  });
  if (!listing) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true }, { status: 200 });
}
