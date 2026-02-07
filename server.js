const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { ADMIN_SECRET_PATH, ADMIN_COOKIE_NAME } = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "listings.json");
const REPORT_THRESHOLD = 3;

const adminSessions = new Set();

app.use(express.json());

const readListings = () => {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

const ensureDataDir = () => {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
};

const writeListings = (listings) => {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(listings, null, 2));
};

const withStats = (listing) => ({
  ...listing,
  stats: {
    views: listing.stats?.views || 0,
    likes: listing.stats?.likes || 0,
    favorites: listing.stats?.favorites || 0,
    reports: listing.stats?.reports || 0,
  },
  hidden: Boolean(listing.hidden),
});

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderAdminPage = (listings) => {
  const flagged = listings.filter(
    (listing) => listing.hidden || (listing.stats?.reports || 0) > 0
  );
  const renderListing = (listing) => `
    <div class="admin-listing">
      <header>
        <strong>${escapeHtml(listing.carName)}</strong>
        <span class="helper">${escapeHtml(listing.price)}</span>
      </header>
      <div class="admin-tags">
        ${listing.hidden ? '<span class="tag danger">Hidden</span>' : ""}
        ${
          (listing.stats?.reports || 0) > 0
            ? '<span class="tag warning">Reported</span>'
            : ""
        }
      </div>
      <div class="helper">${escapeHtml(listing.contact)}</div>
      <div class="stats-row">
        <span>👀 ${listing.stats?.views || 0}</span>
        <span>❤️ ${listing.stats?.likes || 0}</span>
        <span>⭐ ${listing.stats?.favorites || 0}</span>
        <span>⚠️ ${listing.stats?.reports || 0}</span>
      </div>
      <form method="POST" action="listings/${listing.id}/delete">
        <button type="submit" class="ghost danger">Delete</button>
      </form>
    </div>
  `;
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0d0f13" />
        <title>CPM Admin Control</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <header>
          <div class="left-actions">
            <span class="logo">CPM Admin Control</span>
          </div>
        </header>
        <main>
          <section class="admin-panel">
            <div class="admin-card">
              <h3>Control Center</h3>
              <p class="helper">Full visibility of every listing on CPM.</p>
            </div>
            <div class="admin-grid" style="margin-top:18px;">
              <div class="admin-card">
                <h4>All Listings</h4>
                <div class="admin-listings">
                  ${listings.length ? listings.map(renderListing).join("") : "<div>—</div>"}
                </div>
              </div>
              <div class="admin-card">
                <h4>Flagged Listings</h4>
                <div class="admin-listings">
                  ${flagged.length ? flagged.map(renderListing).join("") : "<div>—</div>"}
                </div>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
};

const getCookies = (req) => {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }
  return header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

const requireAdminSession = (req, res, next) => {
  const cookies = getCookies(req);
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token || !adminSessions.has(token)) {
    return res.status(404).end();
  }
  return next();
};

app.get(`/${ADMIN_SECRET_PATH}`, (req, res) => {
  const token = crypto.randomBytes(24).toString("hex");
  adminSessions.add(token);
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 1000 * 60 * 60,
  });
  const listings = readListings().map(withStats);
  res.send(renderAdminPage(listings));
});

app.get("/api/listings", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const listings = readListings().map(withStats);
  res.json(listings);
});

app.post("/api/listings", (req, res) => {
  const listings = readListings();
  const payload = req.body || {};
  const newListing = withStats({
    id: crypto.randomUUID(),
    ownerId: payload.ownerId || null,
    carName: payload.carName || "",
    price: payload.price || "",
    imageUrl: payload.imageUrl || "",
    contact: payload.contact || "",
    pinHash: payload.pinHash || null,
    createdAt: Date.now(),
    stats: { views: 0, likes: 0, favorites: 0, reports: 0 },
    hidden: false,
  });
  listings.unshift(newListing);
  writeListings(listings);
  res.json(listings.map(withStats));
});

app.put("/api/listings/:id", (req, res) => {
  const listings = readListings();
  const payload = req.body || {};
  const updated = listings.map((listing) => {
    if (listing.id !== req.params.id) {
      return listing;
    }
    return {
      ...listing,
      carName: payload.carName ?? listing.carName,
      price: payload.price ?? listing.price,
      imageUrl: payload.imageUrl ?? listing.imageUrl,
      contact: payload.contact ?? listing.contact,
      pinHash: payload.pinHash ?? listing.pinHash,
      updatedAt: Date.now(),
    };
  });
  writeListings(updated);
  res.json(updated.map(withStats));
});

app.post("/api/listings/:id/stats", (req, res) => {
  const listings = readListings();
  const payload = req.body || {};
  const updated = listings.map((listing) => {
    if (listing.id !== req.params.id) {
      return listing;
    }
    const stats = withStats(listing).stats;
    const nextReports = stats.reports + (payload.reportsDelta || 0);
    return {
      ...listing,
      hidden: payload.hidden ?? listing.hidden ?? nextReports >= REPORT_THRESHOLD,
      stats: {
        views: stats.views + (payload.viewsDelta || 0),
        likes: stats.likes + (payload.likesDelta || 0),
        favorites: stats.favorites + (payload.favoritesDelta || 0),
        reports: nextReports,
      },
    };
  });
  writeListings(updated);
  res.json(updated.map(withStats));
});

app.delete("/api/listings/:id", (req, res) => {
  const listings = readListings();
  const updated = listings.filter((listing) => listing.id !== req.params.id);
  writeListings(updated);
  res.json(updated.map(withStats));
});

app.post(`/${ADMIN_SECRET_PATH}/listings/:id/delete`, requireAdminSession, (req, res) => {
  const listings = readListings();
  const updated = listings.filter((listing) => listing.id !== req.params.id);
  writeListings(updated);
  res.redirect(`/${ADMIN_SECRET_PATH}`);
});

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`CPM server running on port ${PORT}`);
});
