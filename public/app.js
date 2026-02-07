const translations = {
  en: {
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    modalCreateTitle: "Create Listing",
    modalEditTitle: "Edit Listing",
    carName: "Car Name",
    price: "Price (CPM)",
    imageUrl: "Image URL",
    contact: "Contact / Social",
    pin: "Optional PIN",
    pinHelper: "Leave blank to keep your listing open.",
    empty: "No listings yet. Tap Create to add the first ride.",
    created: "Listing created.",
    updated: "Listing updated.",
    removed: "Listing removed.",
    ownershipError: "You can only edit your own listings.",
    pinPrompt: "Enter your listing PIN",
    pinError: "Incorrect PIN.",
    favoriteOnly: "⭐ Favorites",
    favoriteOn: "⭐ Favorites only",
    like: "Like",
    favorite: "Favorite",
    report: "Report",
    alreadyReported: "You already reported this listing.",
    reported: "Listing reported.",
    hiddenReport: "Listing hidden after reports.",
    spamCooldown: "Slow down — please wait before posting again.",
    spamLimit: "Listing limit reached. Please try later.",
    spamDuplicate: "Repeated content detected. Please vary your listing.",
    spamFast: "Form submitted too quickly. Please slow down.",
    spamBlocked: "Listing creation temporarily blocked.",
    statsViews: "Views",
    statsLikes: "Likes",
    statsFavorites: "Favorites",
    statsReports: "Reports",
  },
  tr: {
    create: "Oluştur",
    edit: "Düzenle",
    delete: "Sil",
    save: "Kaydet",
    cancel: "İptal",
    modalCreateTitle: "İlan Oluştur",
    modalEditTitle: "İlanı Düzenle",
    carName: "Araç Adı",
    price: "Fiyat (CPM)",
    imageUrl: "Görsel URL",
    contact: "İletişim / Sosyal",
    pin: "İsteğe Bağlı PIN",
    pinHelper: "Boş bırakırsan ilan herkese açık olur.",
    empty: "Henüz ilan yok. İlk ilanı oluşturmak için Oluştur'a dokun.",
    created: "İlan oluşturuldu.",
    updated: "İlan güncellendi.",
    removed: "İlan silindi.",
    ownershipError: "Sadece kendi ilanlarını düzenleyebilirsin.",
    pinPrompt: "İlan PIN'ini gir",
    pinError: "PIN yanlış.",
    favoriteOnly: "⭐ Favoriler",
    favoriteOn: "⭐ Sadece favoriler",
    like: "Beğen",
    favorite: "Favori",
    report: "Bildir",
    alreadyReported: "Bu ilanı zaten bildirdin.",
    reported: "İlan bildirildi.",
    hiddenReport: "İlan, bildirimlerden sonra gizlendi.",
    spamCooldown: "Yavaşla — tekrar paylaşmak için bekle.",
    spamLimit: "İlan limitine ulaştın. Daha sonra tekrar dene.",
    spamDuplicate: "Tekrarlanan içerik algılandı. Lütfen ilanını çeşitlendir.",
    spamFast: "Form çok hızlı gönderildi. Lütfen yavaşla.",
    spamBlocked: "İlan oluşturma geçici olarak engellendi.",
    statsViews: "Görüntülenme",
    statsLikes: "Beğeni",
    statsFavorites: "Favori",
    statsReports: "Bildirim",
  },
};

const storageKeys = {
  device: "cpm_device_id",
  lang: "cpm_lang",
  likes: "cpm_likes",
  favorites: "cpm_favorites",
  reports: "cpm_reports",
  views: "cpm_views",
  submissions: "cpm_submissions",
};

const spamConfig = {
  maxPerWindow: 5,
  windowMs: 60 * 60 * 1000,
  cooldownMs: 60 * 1000,
  minFormMs: 2500,
  blockMs: 5 * 60 * 1000,
  duplicateLimit: 2,
};

const REPORT_THRESHOLD = 3;

const feed = document.getElementById("feed");
const emptyState = document.getElementById("emptyState");
const modal = document.getElementById("modal");
const listingForm = document.getElementById("listingForm");
const toast = document.getElementById("toast");
const modalTitle = document.getElementById("modalTitle");
const favoritesToggle = document.getElementById("favoritesToggle");

let activeLang = localStorage.getItem(storageKeys.lang) || "en";
let editingId = null;
let modalOpenedAt = 0;
let favoritesOnly = false;
let listingsCache = [];

const apiHeaders = { "Content-Type": "application/json" };

const getDeviceId = () => {
  let id = localStorage.getItem(storageKeys.device);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(storageKeys.device, id);
  }
  return id;
};

const getLocalList = (key) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const setLocalList = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const setToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
};

const hashValue = async (value) => {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const fetchListings = async () => {
  const response = await fetch("/api/listings", { cache: "no-store" });
  if (!response.ok) {
    listingsCache = [];
    return listingsCache;
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

const updateListingStats = (listingId, payload) =>
  syncListings(
    fetch(`/api/listings/${listingId}/stats`, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(payload),
    })
  );

const createListing = (payload) =>
  syncListings(
    fetch("/api/listings", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(payload),
    })
  );

const updateListing = (listingId, payload) =>
  syncListings(
    fetch(`/api/listings/${listingId}`, {
      method: "PUT",
      headers: apiHeaders,
      body: JSON.stringify(payload),
    })
  );

const deleteListing = (listingId) =>
  syncListings(
    fetch(`/api/listings/${listingId}`, {
      method: "DELETE",
    })
  );

const applyLocalStatsDelta = (listingId, delta) => {
  listingsCache = listingsCache.map((listing) => {
    if (listing.id !== listingId) {
      return listing;
    }
    const stats = {
      views: listing.stats?.views || 0,
      likes: listing.stats?.likes || 0,
      favorites: listing.stats?.favorites || 0,
      reports: listing.stats?.reports || 0,
    };
    return {
      ...listing,
      hidden: delta.hidden ?? listing.hidden,
      stats: {
        views: stats.views + (delta.viewsDelta || 0),
        likes: stats.likes + (delta.likesDelta || 0),
        favorites: stats.favorites + (delta.favoritesDelta || 0),
        reports: stats.reports + (delta.reportsDelta || 0),
      },
    };
  });
};

const trackView = (listingId) => {
  const viewed = new Set(getLocalList(storageKeys.views));
  if (viewed.has(listingId)) {
    return;
  }
  viewed.add(listingId);
  setLocalList(storageKeys.views, Array.from(viewed));
  applyLocalStatsDelta(listingId, { viewsDelta: 1 });
  updateListingStats(listingId, { viewsDelta: 1 });
};

const toggleLike = (listingId) => {
  const likes = new Set(getLocalList(storageKeys.likes));
  const hasLiked = likes.has(listingId);
  const delta = hasLiked ? -1 : 1;
  applyLocalStatsDelta(listingId, { likesDelta: delta });
  if (hasLiked) {
    likes.delete(listingId);
  } else {
    likes.add(listingId);
  }
  setLocalList(storageKeys.likes, Array.from(likes));
  updateListingStats(listingId, { likesDelta: delta });
  renderListings();
};

const toggleFavorite = (listingId) => {
  const favorites = new Set(getLocalList(storageKeys.favorites));
  const hasFavorited = favorites.has(listingId);
  const delta = hasFavorited ? -1 : 1;
  applyLocalStatsDelta(listingId, { favoritesDelta: delta });
  if (hasFavorited) {
    favorites.delete(listingId);
  } else {
    favorites.add(listingId);
  }
  setLocalList(storageKeys.favorites, Array.from(favorites));
  updateListingStats(listingId, { favoritesDelta: delta });
  renderListings();
};

const reportListing = (listingId) => {
  const reports = new Set(getLocalList(storageKeys.reports));
  if (reports.has(listingId)) {
    setToast(translations[activeLang].alreadyReported);
    return;
  }
  reports.add(listingId);
  setLocalList(storageKeys.reports, Array.from(reports));
  const listing = listingsCache.find((item) => item.id === listingId);
  const nextReports = (listing?.stats?.reports || 0) + 1;
  const shouldHide = nextReports >= REPORT_THRESHOLD;
  applyLocalStatsDelta(listingId, { reportsDelta: 1, hidden: shouldHide || listing?.hidden });
  updateListingStats(listingId, { reportsDelta: 1 });
  if (shouldHide) {
    setToast(translations[activeLang].hiddenReport);
  } else {
    setToast(translations[activeLang].reported);
  }
  renderListings();
};

const getSubmissionState = () => {
  const stored = localStorage.getItem(storageKeys.submissions);
  return stored
    ? JSON.parse(stored)
    : {
        timestamps: [],
        contents: [],
        lastSubmission: 0,
        blockUntil: 0,
      };
};

const saveSubmissionState = (state) => {
  localStorage.setItem(storageKeys.submissions, JSON.stringify(state));
};

const checkSpam = (contentSignature, formDuration) => {
  const state = getSubmissionState();
  const now = Date.now();

  if (state.blockUntil && now < state.blockUntil) {
    return translations[activeLang].spamBlocked;
  }

  if (now - state.lastSubmission < spamConfig.cooldownMs) {
    return translations[activeLang].spamCooldown;
  }

  const recent = state.timestamps.filter((timestamp) => now - timestamp < spamConfig.windowMs);
  if (recent.length >= spamConfig.maxPerWindow) {
    state.blockUntil = now + spamConfig.blockMs;
    saveSubmissionState({ ...state, timestamps: recent });
    return translations[activeLang].spamLimit;
  }

  if (formDuration < spamConfig.minFormMs) {
    return translations[activeLang].spamFast;
  }

  const recentContents = state.contents.slice(0, spamConfig.duplicateLimit);
  if (recentContents.filter((entry) => entry === contentSignature).length >= 1) {
    state.blockUntil = now + spamConfig.blockMs;
    saveSubmissionState(state);
    return translations[activeLang].spamDuplicate;
  }

  state.timestamps = [now, ...recent].slice(0, spamConfig.maxPerWindow + 2);
  state.lastSubmission = now;
  state.contents = [contentSignature, ...state.contents].slice(0, 6);
  saveSubmissionState(state);
  return null;
};

const openModal = (listing = null) => {
  editingId = listing ? listing.id : null;
  modal.classList.add("open");
  modalTitle.textContent = listing
    ? translations[activeLang].modalEditTitle
    : translations[activeLang].modalCreateTitle;
  listingForm.carName.value = listing?.carName || "";
  listingForm.price.value = listing?.price || "";
  listingForm.imageUrl.value = listing?.imageUrl || "";
  listingForm.contact.value = listing?.contact || "";
  listingForm.pin.value = "";
  modalOpenedAt = Date.now();
};

const closeModal = () => {
  modal.classList.remove("open");
  listingForm.reset();
  editingId = null;
};

const verifyPin = async (listing) => {
  if (!listing?.pinHash) {
    return true;
  }
  const input = window.prompt(translations[activeLang].pinPrompt);
  if (!input) {
    return false;
  }
  const hashed = await hashValue(input.trim());
  if (hashed !== listing.pinHash) {
    setToast(translations[activeLang].pinError);
    return false;
  }
  return true;
};

const removeListing = async (id) => {
  const deviceId = getDeviceId();
  const target = listingsCache.find((item) => item.id === id);
  if (target && target.ownerId !== deviceId) {
    setToast(translations[activeLang].ownershipError);
    return;
  }
  if (target?.pinHash && !(await verifyPin(target))) {
    return;
  }
  await deleteListing(id);
  renderListings();
  setToast(translations[activeLang].removed);
};

const renderListings = () => {
  const favorites = new Set(getLocalList(storageKeys.favorites));
  const likes = new Set(getLocalList(storageKeys.likes));
  feed.innerHTML = "";

  const visibleListings = listingsCache.filter((listing) => {
    if (listing.hidden) {
      return false;
    }
    if (favoritesOnly && !favorites.has(listing.id)) {
      return false;
    }
    return true;
  });

  if (!visibleListings.length) {
    emptyState.style.display = "block";
    emptyState.textContent = translations[activeLang].empty;
    return;
  }

  emptyState.style.display = "none";
  visibleListings.forEach((listing) => {
    trackView(listing.id);
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${listing.imageUrl}" alt="${listing.carName}" loading="lazy" />
      <div class="card-body">
        <div class="card-title">${listing.carName}</div>
        <div class="price">${listing.price}</div>
        <div class="contact">${listing.contact}</div>
        <div class="stats-row">
          <span>👀 ${listing.stats.views} ${translations[activeLang].statsViews}</span>
          <span>❤️ ${listing.stats.likes} ${translations[activeLang].statsLikes}</span>
          <span>⭐ ${listing.stats.favorites} ${translations[activeLang].statsFavorites}</span>
          <span>⚠️ ${listing.stats.reports} ${translations[activeLang].statsReports}</span>
        </div>
        <div class="card-actions"></div>
      </div>
    `;
    const actions = card.querySelector(".card-actions");

    const likeBtn = document.createElement("button");
    likeBtn.className = `ghost like ${likes.has(listing.id) ? "active" : ""}`;
    likeBtn.textContent = "❤️";
    likeBtn.setAttribute("aria-label", translations[activeLang].like);
    likeBtn.addEventListener("click", () => toggleLike(listing.id));

    const favBtn = document.createElement("button");
    favBtn.className = `ghost ${favorites.has(listing.id) ? "active" : ""}`;
    favBtn.textContent = "⭐";
    favBtn.setAttribute("aria-label", translations[activeLang].favorite);
    favBtn.addEventListener("click", () => toggleFavorite(listing.id));

    const reportBtn = document.createElement("button");
    reportBtn.className = "ghost report";
    reportBtn.textContent = "⚠️";
    reportBtn.setAttribute("aria-label", translations[activeLang].report);
    reportBtn.addEventListener("click", () => reportListing(listing.id));

    actions.append(likeBtn, favBtn, reportBtn);

    if (listing.ownerId === getDeviceId()) {
      const editBtn = document.createElement("button");
      editBtn.className = "ghost";
      editBtn.textContent = translations[activeLang].edit;
      editBtn.addEventListener("click", async () => {
        if (listing.pinHash && !(await verifyPin(listing))) {
          return;
        }
        openModal(listing);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "ghost danger";
      deleteBtn.textContent = translations[activeLang].delete;
      deleteBtn.addEventListener("click", () => removeListing(listing.id));

      actions.append(editBtn, deleteBtn);
    }
    feed.appendChild(card);
  });
};

const updateTexts = () => {
  document.getElementById("createBtn").textContent = translations[activeLang].create;
  document.getElementById("cancelBtn").textContent = translations[activeLang].cancel;
  document.getElementById("submitBtn").textContent = translations[activeLang].save;
  document.querySelector("label[for='carName']").textContent = translations[activeLang].carName;
  document.querySelector("label[for='price']").textContent = translations[activeLang].price;
  document.querySelector("label[for='imageUrl']").textContent = translations[activeLang].imageUrl;
  document.querySelector("label[for='contact']").textContent = translations[activeLang].contact;
  document.querySelector("label[for='pin']").textContent = translations[activeLang].pin;
  document.getElementById("pinHelper").textContent = translations[activeLang].pinHelper;
  favoritesToggle.textContent = favoritesOnly
    ? translations[activeLang].favoriteOn
    : translations[activeLang].favoriteOnly;
  modalTitle.textContent = editingId
    ? translations[activeLang].modalEditTitle
    : translations[activeLang].modalCreateTitle;

  renderListings();
};

document.getElementById("createBtn").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

favoritesToggle.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  favoritesToggle.classList.toggle("active", favoritesOnly);
  updateTexts();
});

listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const deviceId = getDeviceId();

  const contentSignature = [
    listingForm.imageUrl.value.trim(),
    listingForm.price.value.trim(),
    listingForm.contact.value.trim(),
  ].join("|");

  const spamMessage = checkSpam(contentSignature, Date.now() - modalOpenedAt);
  if (spamMessage) {
    setToast(spamMessage);
    return;
  }

  const pinValue = listingForm.pin.value.trim();
  const pinHash = pinValue ? await hashValue(pinValue) : null;

  if (editingId) {
    const target = listingsCache.find((item) => item.id === editingId);
    if (!target || target.ownerId !== deviceId) {
      setToast(translations[activeLang].ownershipError);
      return;
    }
    await updateListing(editingId, {
      carName: listingForm.carName.value.trim(),
      price: listingForm.price.value.trim(),
      imageUrl: listingForm.imageUrl.value.trim(),
      contact: listingForm.contact.value.trim(),
      pinHash: pinHash || target.pinHash,
    });
    setToast(translations[activeLang].updated);
  } else {
    await createListing({
      ownerId: deviceId,
      carName: listingForm.carName.value.trim(),
      price: listingForm.price.value.trim(),
      imageUrl: listingForm.imageUrl.value.trim(),
      contact: listingForm.contact.value.trim(),
      pinHash: pinHash || null,
    });
    setToast(translations[activeLang].created);
  }
  closeModal();
  renderListings();
});

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

setInterval(async () => {
  await fetchListings();
  renderListings();
}, 30000);

document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) {
    await fetchListings();
    renderListings();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
