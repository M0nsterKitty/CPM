import { getListings, getReports } from "../../lib/store";
import AdminPanel from "../../components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const listings = await getListings();
  const reports = await getReports();
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
  const preparedListings = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    likesCount: listing.likes?.length || 0,
    favoritesCount: listing.favorites?.length || 0
  }));
  const preparedReports = reports.map((report) => ({
    ...report,
    listingTitle: listingMap.get(report.listingId)?.title || "Unknown listing"
  }));

  return <AdminPanel listings={preparedListings} reports={preparedReports} />;
}
