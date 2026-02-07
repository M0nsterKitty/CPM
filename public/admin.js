const translations = {
  en: {
    adminContentTitle: "Control Center",
    adminSubtitle: "Full visibility of every listing on CPM.",
    adminLogs: "Admin Logs",
    adminListings: "All Listings",
    adminReported: "Reported Listings",
    adminReportedEmpty: "No reported listings.",
    adminDelete: "Force Delete",
    adminHide: "Hide",
    adminShow: "Show",
    adminDeleted: "Listing removed.",
    adminVisibility: "Visibility updated.",
    adminLoadError: "Unable to load listings.",
    hiddenTag: "Hidden",
    reportedTag: "Reported",
    ownedTag: "Owner",
  },
  tr: {
    adminContentTitle: "Kontrol Merkezi",
    adminSubtitle: "CPM'deki tüm ilanları gör.",
    adminLogs: "Admin Kayıtları",
    adminListings: "Tüm İlanlar",
    adminReported: "Bildirilen İlanlar",
    adminReportedEmpty: "Bildirilen ilan yok.",
    adminDelete: "Zorla Sil",
    adminHide: "Gizle",
    adminShow: "Göster",
    adminDeleted: "İlan silindi.",
    adminVisibility: "Görünürlük güncellendi.",
    adminLoadError: "İlanlar yüklenemedi.",
    hiddenTag: "Gizli",
    reportedTag: "Bildirildi",
    ownedTag: "Sahibi",
  },
};

const storageKeys = {
  lang: "cpm_lang",
  logs: "cpm_admin_logs",
};

const REPORT_THRESHOLD = 3;

const adminLogsEl = document.getElementById("adminLogs");
const adminListingsEl = document.getElementById("adminListings");
const adminReportedEl = document.getElementById("adminReportedListings");
const toast = document.getElementById("toast");

let activeLang = localStorage.getItem(storageKeys.lang) || "en";
let listingsCache = [];

const apiHeaders = { "Content-Type": "application/json" };

const setToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
};

const getLogs = () => {
  const stored = localStorage.getItem(storageKeys.logs);
  return stored ? JSON.parse(stored) : [];
};

const setLogs = (logs) => {
  localStorage.setItem(storageKeys.logs, JSON.stringify(logs));
};

const logAdminAction = (action, listingId = null) => {
  const logs = getLogs();
  logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), action, listingId });
  setLogs(logs.slice(0, 200));
  renderAdminLogs();
};

const renderAdminLogs = () => {
  const logs = getLogs();
  adminLogsEl.innerHTML =
    logs
      .slice(0, 60)
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleString();
        return `<div>• ${time} — ${entry.action}${entry.listingId ? ` (${entry.listingId})` : ""}</div>`;
      })
      .join("") || "<div>—</div>";
};

const fetchListings = async () => {
  const response = await fetch("/api/listings", { cache: "no-store" });
  if (!response.ok) {
    setToast(translations[activeLang].adminLoadError);
    return [];
  }
  listingsCache = await response.json();
  return listingsCache;
};

const syncListings = async (responsePromise) => {
  const response = await responsePromise;
  if (!response.ok) {
    return listingsCache;
  }
  listingsCache = await response.json();
  return listingsCache;
};

const adminDeleteListing = (listingId) =>
  syncListings(
    fetch(`/api/admin/listings/${listingId}/delete`, {
      method: "POST",
      headers: apiHeaders,
    })
  );

const adminToggleVisibility = (listingId, hidden) =>
  syncListings(
    fetch(`/api/admin/listings/${listingId}/visibility`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({ hidden }),
    })
  );

const renderAdminListings = () => {
  adminListingsEl.innerHTML = "";
  listingsCache.forEach((listing) => {
    const item = document.createElement("div");
    item.className = "admin-listing";
    const tags = [];
    if (listing.hidden) {
      tags.push(`<span class="tag danger">${translations[activeLang].hiddenTag}</span>`);
    }
    if ((listing.stats?.reports || 0) >= REPORT_THRESHOLD) {
      tags.push(`<span class="tag warning">${translations[activeLang].reportedTag}</span>`);
    }
    if (listing.ownerId) {
      tags.push(`<span class="tag">${translations[activeLang].ownedTag}</span>`);
    }

    item.innerHTML = `
      <header>
        <strong>${listing.carName}</strong>
        <span class="helper">${listing.price}</span>
      </header>
      <div class="admin-tags">${tags.join("")}</div>
      <div class="helper">${listing.contact}</div>
      <div class="stats-row">
        <span>👀 ${listing.stats?.views || 0}</span>
        <span>❤️ ${listing.stats?.likes || 0}</span>
        <span>⭐ ${listing.stats?.favorites || 0}</span>
        <span>⚠️ ${listing.stats?.reports || 0}</span>
      </div>
      <div class="card-actions"></div>
    `;

    const actions = item.querySelector(".card-actions");

    const visibilityBtn = document.createElement("button");
    visibilityBtn.className = "ghost";
    visibilityBtn.textContent = listing.hidden
      ? translations[activeLang].adminShow
      : translations[activeLang].adminHide;
    visibilityBtn.addEventListener("click", async () => {
      await adminToggleVisibility(listing.id, !listing.hidden);
      logAdminAction("visibility_toggle", listing.id);
      renderAdminListings();
      renderReportedListings();
      setToast(translations[activeLang].adminVisibility);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost danger";
    deleteBtn.textContent = translations[activeLang].adminDelete;
    deleteBtn.addEventListener("click", async () => {
      await adminDeleteListing(listing.id);
      logAdminAction("force_delete", listing.id);
      renderAdminListings();
      renderReportedListings();
      setToast(translations[activeLang].adminDeleted);
    });

    actions.append(visibilityBtn, deleteBtn);
    adminListingsEl.appendChild(item);
  });
};

const renderReportedListings = () => {
  adminReportedEl.innerHTML = "";
  const reportedListings = listingsCache.filter((listing) => (listing.stats?.reports || 0) > 0);
  if (!reportedListings.length) {
    adminReportedEl.innerHTML = `<div class="helper">${translations[activeLang].adminReportedEmpty}</div>`;
    return;
  }
  reportedListings.forEach((listing) => {
    const item = document.createElement("div");
    item.className = "admin-listing";
    item.innerHTML = `
      <header>
        <strong>${listing.carName}</strong>
        <span class="helper">${listing.price}</span>
      </header>
      <div class="admin-tags">
        <span class="tag warning">${translations[activeLang].reportedTag}</span>
      </div>
      <div class="helper">${listing.contact}</div>
      <div class="stats-row">
        <span>👀 ${listing.stats?.views || 0}</span>
        <span>❤️ ${listing.stats?.likes || 0}</span>
        <span>⭐ ${listing.stats?.favorites || 0}</span>
        <span>⚠️ ${listing.stats?.reports || 0}</span>
      </div>
      <div class="card-actions"></div>
    `;

    const actions = item.querySelector(".card-actions");

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost danger";
    deleteBtn.textContent = translations[activeLang].adminDelete;
    deleteBtn.addEventListener("click", async () => {
      await adminDeleteListing(listing.id);
      logAdminAction("force_delete", listing.id);
      renderAdminListings();
      renderReportedListings();
      setToast(translations[activeLang].adminDeleted);
    });

    actions.append(deleteBtn);
    adminReportedEl.appendChild(item);
  });
};

const updateTexts = () => {
  document.getElementById("adminContentTitle").textContent = translations[activeLang].adminContentTitle;
  document.getElementById("adminSubtitle").textContent = translations[activeLang].adminSubtitle;
  document.getElementById("logsTitle").textContent = translations[activeLang].adminLogs;
  document.getElementById("adminListingsTitle").textContent = translations[activeLang].adminListings;
  document.getElementById("adminReportedTitle").textContent = translations[activeLang].adminReported;
  renderAdminLogs();
  renderAdminListings();
  renderReportedListings();
};

document.querySelectorAll(".lang-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    activeLang = button.dataset.lang;
    localStorage.setItem(storageKeys.lang, activeLang);
    document.querySelectorAll(".lang-switch button").forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.lang === activeLang)
    );
    updateTexts();
  });
});

const init = async () => {
  await fetchListings();
  updateTexts();
};

init();
