"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const initialState = {
  title: "",
  description: "",
  price: "",
  imageUrl: ""
};

export default function ListingForm() {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create listing.");
      }
      setForm(initialState);
      setStatus("success");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2>Create a listing</h2>
      <p className="meta">Listings appear instantly on the homepage.</p>
      <form onSubmit={onSubmit} className="grid" style={{ marginTop: 16 }}>
        <div>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Modern studio apartment"
            required
          />
        </div>
        <div>
          <label htmlFor="price">Price</label>
          <input
            id="price"
            name="price"
            value={form.price}
            onChange={onChange}
            placeholder="$120 per night"
            required
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={onChange}
            placeholder="Share the details of your listing."
            required
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="imageUrl">Image URL (optional)</label>
          <input
            id="imageUrl"
            name="imageUrl"
            value={form.imageUrl}
            onChange={onChange}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12 }}>
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Creating..." : "Create listing"}
          </button>
          {status === "success" && (
            <span className="meta">Listing created.</span>
          )}
          {status === "error" && <span className="meta">{error}</span>}
        </div>
      </form>
    </section>
  );
}
