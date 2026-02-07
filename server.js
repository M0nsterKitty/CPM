const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const { ADMIN_SECRET_PATH, ADMIN_COOKIE_NAME } = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "listings.json");
const ADMIN_TEMPLATE = path.join(__dirname, "templates", "admin.html");
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

const writeListings = (listings) => {
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
  res.sendFile(ADMIN_TEMPLATE);
});

app.get("/api/listings", (req, res) => {
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

app.post("/api/admin/listings/:id/visibility", requireAdminSession, (req, res) => {
  const listings = readListings();
  const payload = req.body || {};
  const updated = listings.map((listing) =>
    listing.id === req.params.id ? { ...listing, hidden: Boolean(payload.hidden) } : listing
  );
  writeListings(updated);
  res.json(updated.map(withStats));
});

app.post("/api/admin/listings/:id/delete", requireAdminSession, (req, res) => {
  const listings = readListings();
  const updated = listings.filter((listing) => listing.id !== req.params.id);
  writeListings(updated);
  res.json(updated.map(withStats));
});

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`CPM server running on port ${PORT}`);
});
