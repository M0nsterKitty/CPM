import { NextResponse } from "next/server";
import { createListing, getListings } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await getListings();
  return NextResponse.json({ listings }, { status: 200 });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const title = body.title?.trim();
    const description = body.description?.trim();
    const price = body.price?.trim();
    const imageUrl = body.imageUrl?.trim();

    if (!title || !description || !price) {
      return NextResponse.json(
        { message: "Title, description, and price are required." },
        { status: 400 }
      );
    }

    const listing = await createListing({
      title,
      description,
      price,
      imageUrl
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: "Unable to create listing." },
      { status: 500 }
    );
  }
}
