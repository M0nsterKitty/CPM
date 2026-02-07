"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ListingGrid({ listings }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState("");

  const runAction = async (listingId, action, payload) => {
    setPendingId(listingId + action);
    try {
      const response = await fetch(`/api/listings/${listingId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Action failed");
      }
      router.refresh();
    } catch (error) {
      window.alert(error.message);
    } finally {
      setPendingId("");
    }
  };

  if (!listings.length) {
    return (
      <section className="card">
        <h2>All listings</h2>
        <div className="empty">No listings yet. Create the first one.</div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>All listings</h2>
      <div className="grid" style={{ marginTop: 16 }}>
        {listings.map((listing) => (
          <article key={listing.id} className="card">
            <div className="listing-title">
              <div>
                <h3>{listing.title}</h3>
                <div className="meta">{listing.description}</div>
              </div>
              <span className="badge">{listing.price}</span>
            </div>
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  marginTop: 12,
                  objectFit: "cover",
                  maxHeight: 220
                }}
                loading="lazy"
              />
            ) : null}
            <div className="meta" style={{ marginTop: 12 }}>
              {listing.likesCount} likes · {listing.favoritesCount} favorites
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className={listing.likedByUser ? "secondary" : "ghost"}
                disabled={pendingId === listing.id + "like"}
                onClick={() => runAction(listing.id, "like")}
              >
                {listing.likedByUser ? "Liked" : "Like"}
              </button>
              <button
                type="button"
                className={listing.favoritedByUser ? "secondary" : "ghost"}
                disabled={pendingId === listing.id + "favorite"}
                onClick={() => runAction(listing.id, "favorite")}
              >
                {listing.favoritedByUser ? "Favorited" : "Favorite"}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={pendingId === listing.id + "report"}
                onClick={() => {
                  const reason = window.prompt(
                    "Why are you reporting this listing?",
                    ""
                  );
                  if (reason === null) {
                    return;
                  }
                  runAction(listing.id, "report", { reason });
                }}
              >
                Report
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
