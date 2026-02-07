import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { toggleLike } from "../../../../../lib/store";

export async function POST(request, { params }) {
  const userId = cookies().get("uid")?.value;
  if (!userId) {
    return NextResponse.json(
      { message: "User session not available." },
      { status: 400 }
    );
  }
  const listing = await toggleLike({ listingId: params.id, userId });
  if (!listing) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json(
    { likesCount: listing.likes?.length || 0 },
    { status: 200 }
  );
}
