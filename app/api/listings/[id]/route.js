import { NextResponse } from "next/server";
import { deleteListing } from "../../../../lib/store";

export async function DELETE(request, { params }) {
  const { id } = params;
  const removed = await deleteListing(id);
  if (!removed) {
    return NextResponse.json({ message: "Listing not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true }, { status: 200 });
}
