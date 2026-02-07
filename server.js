import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gizli admin URL eki: değiştirmek için yalnızca CPM_ADMIN_SLUG değerini güncelleyin.
const ADMIN_SLUG = process.env.CPM_ADMIN_SLUG || "cpm-7f2b9f4a81d64ac09f27d2b32c8e0d7f";
const ADMIN_COOKIE = "cpm_admin";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const DATA_FILE = path.join(__dirname, "data", "listings.json");
const REPORT_THRESHOLD = 3;

const app = express();
const adminSessions = new Map();

app.use(express.json({ limit: "200kb" }));

const ensureDataFile = async () => {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
};

const readListings = async () => {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
};

const writeListings = async (listings) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(listings, null, 2), "utf8");
};

const hashValue = (value) => crypto.createHash("sha256").update(value).digest("hex");

const toClientListing = (listing) => {
  const { pinHash, ...rest } = listing;
  return { ...rest, hasPin: Boolean(pinHash) };
};

const getCookie = (req, name) => {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.split("=")[1]);
};

const isAdminRequest = (req) => {
  const token = getCookie(req, ADMIN_COOKIE);
  if (!token) {
    return false;
  }
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
};

const requireAdmin = (req, res, next) => {
  if (!isAdminRequest(req)) {
    res.status(404).send("Not found");
    return;
  }
  next();
};

const getDeviceId = (req) => req.headers["x-device-id"]?.toString();

const requireDevice = (req, res, next) => {
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    res.status(400).json({ error: "Missing device identifier." });
    return;
  }
  next();
};

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "sw.js"));
});

app.get(`/${ADMIN_SLUG}`, (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: ADMIN_SESSION_TTL_MS,
  });
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});

app.get("/api/listings", async (req, res) => {
  const listings = await readListings();
  const visible = listings.filter((listing) => !listing.hidden);
  res.json(visible.map(toClientListing));
});

app.post("/api/listings", requireDevice, async (req, res) => {
  const { carName, price, imageUrl, contact, pin } = req.body;
  if (!carName || !price || !imageUrl || !contact) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }
  const listings = await readListings();
  const now = Date.now();
  const listing = {
    id: crypto.randomUUID(),
    ownerId: getDeviceId(req),
    carName: carName.trim(),
    price: price.trim(),
    imageUrl: imageUrl.trim(),
    contact: contact.trim(),
    pinHash: pin ? hashValue(pin.trim()) : null,
    createdAt: now,
    updatedAt: now,
    stats: { views: 0, likes: 0, favorites: 0, reports: 0 },
    hidden: false,
  };
  listings.unshift(listing);
  await writeListings(listings);
  res.json(toClientListing(listing));
});

app.put("/api/listings/:id", requireDevice, async (req, res) => {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === req.params.id);
  if (!listing) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  if (listing.ownerId !== getDeviceId(req)) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  if (listing.pinHash) {
    const pin = req.body.pin?.trim();
    if (!pin || hashValue(pin) !== listing.pinHash) {
      res.status(403).json({ error: "Invalid PIN." });
      return;
    }
  }
  listing.carName = req.body.carName?.trim() || listing.carName;
  listing.price = req.body.price?.trim() || listing.price;
  listing.imageUrl = req.body.imageUrl?.trim() || listing.imageUrl;
  listing.contact = req.body.contact?.trim() || listing.contact;
  if (req.body.pin) {
    listing.pinHash = hashValue(req.body.pin.trim());
  }
  listing.updatedAt = Date.now();
  await writeListings(listings);
  res.json(toClientListing(listing));
});

app.delete("/api/listings/:id", requireDevice, async (req, res) => {
  const listings = await readListings();
  const index = listings.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  const listing = listings[index];
  if (listing.ownerId !== getDeviceId(req)) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  if (listing.pinHash) {
    const pin = req.body.pin?.trim();
    if (!pin || hashValue(pin) !== listing.pinHash) {
      res.status(403).json({ error: "Invalid PIN." });
      return;
    }
  }
  listings.splice(index, 1);
  await writeListings(listings);
  res.json({ success: true });
});

app.post("/api/listings/:id/like", requireDevice, async (req, res) => {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === req.params.id);
  if (!listing || listing.hidden) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  const delta = req.body.action === "remove" ? -1 : 1;
  listing.stats.likes = Math.max(0, listing.stats.likes + delta);
  await writeListings(listings);
  res.json(toClientListing(listing));
});

app.post("/api/listings/:id/favorite", requireDevice, async (req, res) => {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === req.params.id);
  if (!listing || listing.hidden) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  const delta = req.body.action === "remove" ? -1 : 1;
  listing.stats.favorites = Math.max(0, listing.stats.favorites + delta);
  await writeListings(listings);
  res.json(toClientListing(listing));
});

app.post("/api/listings/:id/report", requireDevice, async (req, res) => {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === req.params.id);
  if (!listing || listing.hidden) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  listing.stats.reports += 1;
  if (listing.stats.reports >= REPORT_THRESHOLD) {
    listing.hidden = true;
  }
  await writeListings(listings);
  res.json(toClientListing(listing));
});

app.post("/api/listings/:id/view", requireDevice, async (req, res) => {
  const listings = await readListings();
  const listing = listings.find((item) => item.id === req.params.id);
  if (!listing || listing.hidden) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  listing.stats.views += 1;
  await writeListings(listings);
  res.json(toClientListing(listing));
});

app.get("/api/admin/listings", requireAdmin, async (req, res) => {
  const listings = await readListings();
  res.json(listings.map(toClientListing));
});

app.delete("/api/admin/listings/:id", requireAdmin, async (req, res) => {
  const listings = await readListings();
  const index = listings.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  listings.splice(index, 1);
  await writeListings(listings);
  res.json({ success: true });
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`CPM server running on ${port}`);
});
