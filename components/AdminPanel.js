"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPanel({ listings, reports }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState("");

  const deleteListing = async (listingId) => {
    if (!window.confirm("Delete this listing? This cannot be undone.")) {
      return;
    }
    setDeletingId(listingId);
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Delete failed");
      }
      router.refresh();
    } catch (error) {
      window.alert(error.message);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
      <section className="card">
        <div className="admin-header">
          <div>
            <h2>Admin panel</h2>
            <p className="meta">
              Only people with this secret URL can access this page.
            </p>
          </div>
          <span className="badge">Private</span>
        </div>
      </section>

      <section className="card">
        <h3>All listings</h3>
        {listings.length ? (
          <div className="admin-grid" style={{ marginTop: 16 }}>
            {listings.map((listing) => (
              <article key={listing.id} className="card">
                <div className="listing-title">
                  <div>
                    <h3>{listing.title}</h3>
                    <div className="meta">{listing.description}</div>
                  </div>
                  <span className="badge">{listing.price}</span>
                </div>
                <div className="meta" style={{ marginTop: 12 }}>
                  {listing.likesCount} likes · {listing.favoritesCount} favorites
                </div>
                <div className="actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="ghost"
                    disabled={deletingId === listing.id}
                    onClick={() => deleteListing(listing.id)}
                  >
                    {deletingId === listing.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No listings available.</div>
        )}
      </section>

      <section className="card">
        <h3>Reported listings</h3>
        {reports.length ? (
          <div className="admin-grid" style={{ marginTop: 16 }}>
            {reports.map((report) => (
              <article key={report.id} className="card">
                <div className="listing-title">
                  <div>
                    <h3>{report.listingTitle}</h3>
                    <div className="meta">
                      {report.reason || "No reason provided"}
                    </div>
                  </div>
                  <span className="badge">Report</span>
                </div>
                <div className="meta" style={{ marginTop: 12 }}>
                  {new Date(report.createdAt).toLocaleString()}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No reports submitted.</div>
        )}
      </section>
    </div>
  );
}
