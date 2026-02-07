import { cookies } from "next/headers";
import ListingForm from "../components/ListingForm";
import ListingGrid from "../components/ListingGrid";
import { getListings } from "../lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = cookies().get("uid")?.value;
  const listings = await getListings();
  const prepared = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    imageUrl: listing.imageUrl,
    likesCount: listing.likes?.length || 0,
    favoritesCount: listing.favorites?.length || 0,
    likedByUser: userId ? listing.likes?.includes(userId) : false,
    favoritedByUser: userId ? listing.favorites?.includes(userId) : false
  }));

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
      <ListingForm />
      <ListingGrid listings={prepared} />
    </div>
  );
}
