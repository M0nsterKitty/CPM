import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const dataFile = path.join(process.cwd(), "data", "listings.json");
let writeQueue = Promise.resolve();

async function ensureDataFile() {
  try {
    await fs.access(dataFile);
  } catch {
    const initial = { listings: [], reports: [] };
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(initial, null, 2));
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");
  if (!raw.trim()) {
    return { listings: [], reports: [] };
  }
  const parsed = JSON.parse(raw);
  return {
    listings: parsed.listings ?? [],
    reports: parsed.reports ?? []
  };
}

async function writeData(nextData) {
  await ensureDataFile();
  writeQueue = writeQueue.then(() =>
    fs.writeFile(dataFile, JSON.stringify(nextData, null, 2))
  );
  return writeQueue;
}

export async function getListings() {
  const { listings } = await readData();
  return listings;
}

export async function getReports() {
  const { reports } = await readData();
  return reports;
}

export async function createListing({ title, description, price, imageUrl }) {
  const data = await readData();
  const listing = {
    id: randomUUID(),
    title,
    description,
    price,
    imageUrl: imageUrl || "",
    createdAt: new Date().toISOString(),
    likes: [],
    favorites: []
  };
  data.listings.unshift(listing);
  await writeData(data);
  return listing;
}

export async function toggleLike({ listingId, userId }) {
  const data = await readData();
  const listing = data.listings.find((item) => item.id === listingId);
  if (!listing) {
    return null;
  }
  listing.likes = listing.likes || [];
  if (listing.likes.includes(userId)) {
    listing.likes = listing.likes.filter((id) => id !== userId);
  } else {
    listing.likes.push(userId);
  }
  await writeData(data);
  return listing;
}

export async function toggleFavorite({ listingId, userId }) {
  const data = await readData();
  const listing = data.listings.find((item) => item.id === listingId);
  if (!listing) {
    return null;
  }
  listing.favorites = listing.favorites || [];
  if (listing.favorites.includes(userId)) {
    listing.favorites = listing.favorites.filter((id) => id !== userId);
  } else {
    listing.favorites.push(userId);
  }
  await writeData(data);
  return listing;
}

export async function reportListing({ listingId, userId, reason }) {
  const data = await readData();
  const listing = data.listings.find((item) => item.id === listingId);
  if (!listing) {
    return null;
  }
  data.reports.unshift({
    id: randomUUID(),
    listingId,
    userId,
    reason,
    createdAt: new Date().toISOString()
  });
  await writeData(data);
  return listing;
}

export async function deleteListing(listingId) {
  const data = await readData();
  const nextListings = data.listings.filter((item) => item.id !== listingId);
  if (nextListings.length === data.listings.length) {
    return false;
  }
  data.listings = nextListings;
  data.reports = data.reports.filter((report) => report.listingId !== listingId);
  await writeData(data);
  return true;
}

export async function getListingById(listingId) {
  const data = await readData();
  return data.listings.find((item) => item.id === listingId) || null;
}
