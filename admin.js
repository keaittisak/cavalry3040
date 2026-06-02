const adminUserInput = document.querySelector("#admin-user");
const adminCodeInput = document.querySelector("#admin-code");
const adminUnlock = document.querySelector("#admin-unlock");
const adminStatus = document.querySelector("#admin-status");
const adminContent = document.querySelector("#admin-content");
const adminSummary = document.querySelector("#admin-system-summary");
const adminSettings = document.querySelector("#admin-settings");
const adminSettingsReset = document.querySelector("#admin-settings-reset");
const adminExportSiteData = document.querySelector("#admin-export-site-data");
const souvenirPreview = document.querySelector("#souvenir-preview");
const adminUserForm = document.querySelector("#admin-user-form");
const adminUserStatus = document.querySelector("#admin-user-status");
const adminUserList = document.querySelector("#admin-user-list");
const roomPermissionNote = document.querySelector("#room-permission-note");
const roomForms = Array.from(document.querySelectorAll("[data-room-form]"));
const getRoomFormByKind = (kind) => roomForms.find((form) => form.dataset.roomKind === kind) || roomForms[0];
const roomStatus = document.querySelector("#room-status");
const roomSubmitButtons = Array.from(document.querySelectorAll("[data-room-submit]"));
const roomCancelButtons = Array.from(document.querySelectorAll("[data-room-cancel]"));
const roomAdminList = document.querySelector("#room-admin-list");
const rootOnlySections = document.querySelectorAll(".root-only");

const legacySubPassword = "cavalry3040";
const defaultRootPassword = "root3040";
const partyKey = "cavalry3040PartyRegistrations";
const settingsKey = "cavalry3040PartySettings";
const directoryKey = "cavalry3040DirectoryMembers";
const roomsKey = "cavalry3040PartyRooms";
const adminUsersKey = "cavalry3040AdminUsers";
const currency = new Intl.NumberFormat("th-TH");
let currentAdmin = null;
let editingRoomId = "";
let siteData = { settings: {}, rooms: [], registrations: [] };

const loadSiteData = async () => {
  try {
    const response = await fetch("site-data.json", { cache: "no-store" });
    if (!response.ok) return;
    siteData = { ...siteData, ...(await response.json()) };
  } catch (error) {
    console.warn("Cannot load site-data.json", error);
  }
};

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    console.warn("Reset invalid localStorage data for", key, error);
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
};

const createId = (prefix) => globalThis.crypto?.randomUUID?.() || prefix + "-" + Date.now();
const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));
const parsePositiveNumber = (value) => {
  const normalized = String(value || "").replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit)).replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
};

const getSettings = () => ({ eventFee: 0, shirtPrice: 0, souvenirPrice: 0, souvenirImage: null, ...(siteData.settings || {}), ...readJson(settingsKey, {}) });
const saveSettings = (settings) => localStorage.setItem(settingsKey, JSON.stringify(settings));
const getPartyItems = () => readJson(partyKey, siteData.registrations || []);
const savePartyItems = (items) => localStorage.setItem(partyKey, JSON.stringify(items));
const getMembers = () => readJson(directoryKey, []);
const getRooms = () => readJson(roomsKey, siteData.rooms || []).map((room, index) => ({
  ...room,
  id: room.id || "legacy-room-" + index + "-" + (room.createdAt || index)
}));
const saveRooms = (rooms) => localStorage.setItem(roomsKey, JSON.stringify(rooms));

const getAdminUsers = () => {
  const users = readJson(adminUsersKey, []);
  const seeded = [...users];
  if (!seeded.some((user) => user.username === "root")) {
    seeded.unshift({ id: "root-default", username: "root", password: defaultRootPassword, role: "root", createdAt: new Date().toISOString() });
  }
  if (!seeded.some((user) => user.username === "admin" || user.password === legacySubPassword)) {
    seeded.push({ id: "sub-default", username: "admin", password: legacySubPassword, role: "sub", createdAt: new Date().toISOString() });
  }
  localStorage.setItem(adminUsersKey, JSON.stringify(seeded));
  return seeded;
};
const saveAdminUsers = (users) => localStorage.setItem(adminUsersKey, JSON.stringify(users));

const getRoomBookings = (item) => {
  if (Array.isArray(item?.roomBookings)) return item.roomBookings.filter((booking) => booking?.roomId);
  if (item?.roomId) return [{ roomId: item.roomId, guests: getGuestCount(item.roomGuestCount || item.guestCount) }];
  return [];
};
const getPendingRoomGuests = (item) => getGuestCount(item?.pendingRoomGuests);
const getRoomPlan = (bookings = [], pendingGuests = 0) => {
  const rooms = getRooms();
  const extraRoomCount = pendingGuests > 0 ? Math.ceil(pendingGuests / 3) : Math.max(bookings.length - 1, 0);
  const largeRoomCharge = bookings.reduce((sum, booking) => {
    const room = rooms.find((item) => item.id === booking.roomId);
    return sum + (isLargeRoom(room) ? parsePositiveNumber(room.largeRoomPrice) : 0);
  }, 0);
  return { extraRoomCount, largeRoomCharge };
};
const calculateTotal = (item) => {
  const settings = getSettings();
  const paidShirts = Math.max(Number(item.shirtCount || 0) - 1, 0);
  const eventFee = item.eventFee !== undefined ? Number(item.eventFee || 0) : Number(settings.eventFee || 0);
  const shirtPrice = item.shirtPrice !== undefined ? Number(item.shirtPrice || 0) : Number(settings.shirtPrice || 0);
  const souvenirPrice = item.souvenirPrice !== undefined ? Number(item.souvenirPrice || 0) : Number(settings.souvenirPrice || 0);
  const roomPlan = getRoomPlan(getRoomBookings(item), getPendingRoomGuests(item));
  const largeRoomCharge = roomPlan.largeRoomCharge || Number(item.largeRoomCharge || 0);
  return eventFee + paidShirts * shirtPrice + (item.souvenirReserved && souvenirPrice > 0 ? souvenirPrice : 0) + largeRoomCharge;
};
const normalizePartyItems = () => getPartyItems().map((item, index) => ({
  ...item,
  id: item.id || "legacy-party-" + index + "-" + (item.registeredAt || index),
  paymentStatus: item.paymentStatus || (item.paymentProof ? "รอตรวจสอบ" : "ยังไม่ชำระ"),
  totalDue: calculateTotal(item)
}));
const recalculatePartyCosts = (settings) => {
  savePartyItems(normalizePartyItems().map((item) => ({
    ...item,
    eventFee: settings.eventFee,
    shirtPrice: settings.shirtPrice,
    souvenirPrice: settings.souvenirPrice,
    souvenirReserved: Boolean(item.souvenirReserved) && settings.souvenirPrice > 0,
    totalDue: calculateTotal({ ...item, ...settings, souvenirReserved: Boolean(item.souvenirReserved) && settings.souvenirPrice > 0 })
  })));
};
const normalizeMembers = () => getMembers().map((item, index) => ({
  ...item,
  id: item.id || "legacy-member-" + index + "-" + (item.createdAt || index)
}));

const getRoomCapacity = (room) => parsePositiveNumber(room?.maxGuests ?? room?.guestCount ?? room?.capacity) || 3;
const isLargeRoom = (room) => getRoomCapacity(room) > 3;
const getGuestCount = (value) => parsePositiveNumber(value);
const getRoomUsage = (roomId, registrations = normalizePartyItems()) => registrations
  .reduce((sum, item) => sum + getRoomBookings(item).filter((booking) => booking.roomId === roomId).reduce((bookingSum, booking) => bookingSum + getGuestCount(booking.guests), 0), 0);
const getRoomLabel = (room) => room ? "ห้อง " + room.roomNumber + " - " + room.roomName : "-";
const getBedType = (room) => room?.bedType || (room?.bedCount ? room.bedCount + " เตียงนอน" : "-");
const getDisplayName = (item) => [item?.rank, item?.firstName, item?.lastName].filter(Boolean).join(" ").trim() || "ไม่ระบุชื่อ";
const getRoomImages = (room) => {
  if (Array.isArray(room?.images) && room.images.length > 0) return room.images;
  if (room?.image?.dataUrl) return [room.image];
  return [];
};
const readFileAsDataUrl = (file, maxSize = 1280, quality = 0.82) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (!file?.type?.startsWith("image/")) {
      resolve(reader.result);
      return;
    }

    const image = new Image();
    image.onload = () => {
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(outputType === "image/png" ? canvas.toDataURL(outputType) : canvas.toDataURL(outputType, quality));
    };
    image.onerror = reject;
    image.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
const renderRoomImages = (room, altText) => {
  const images = getRoomImages(room).slice(0, 5);
  if (images.length === 0) return `<div class="room-image-placeholder">ไม่มีรูป</div>`;
  const gallery = `<div class="room-image-gallery">${images.map((image, index) => `<img src="${image.dataUrl}" alt="${escapeHtml(altText)} ภาพที่ ${index + 1}">`).join("")}</div>`;
  const controls = images.length > 1 ? `<div class="room-image-controls"><button type="button" data-gallery-scroll="prev" aria-label="ดูภาพก่อนหน้า">‹</button><span data-gallery-counter>1/${images.length}</span><button type="button" data-gallery-scroll="next" aria-label="ดูภาพถัดไป">›</button></div>` : "";
  return `<div class="room-image-slider">${gallery}${controls}</div>`;
};
const updateGalleryCounter = (gallery) => {
  const items = Array.from(gallery.children);
  const counter = gallery.closest(".room-image-slider")?.querySelector("[data-gallery-counter]");
  if (!counter || items.length === 0) return;
  const index = Math.round(gallery.scrollLeft / Math.max(gallery.clientWidth, 1));
  counter.textContent = Math.min(index + 1, items.length) + "/" + items.length;
};
const getAssignableGuests = (item, remaining, room = null) => Math.min(getPendingRoomGuests(item) || (getRoomBookings(item).length ? 0 : getGuestCount(item.guestCount)), remaining, getRoomCapacity(room));
const getAvailableMembers = (room, registrations, used) => {
  const remaining = Math.max(getRoomCapacity(room) - used, 0);
  return registrations
    .filter((item) => !getRoomBookings(item).some((booking) => booking.roomId === room.id) && getAssignableGuests(item, remaining, room) > 0)
    .map((item) => {
      const assignGuests = getAssignableGuests(item, remaining, room);
      const roomText = getPendingRoomGuests(item) ? "ค้างจัดห้อง - จัดเพิ่ม" : "ยังไม่จอง - จัดเข้าห้องนี้";
      return `<button class="button button--ghost compact-action" type="button" data-assign-member="${item.id}" data-assign-room="${room.id}">${escapeHtml(getDisplayName(item))} (${assignGuests} คน) • ${roomText}</button>`;
    })
    .join("");
};

const renderSummary = () => {
  const items = normalizePartyItems();
  const members = normalizeMembers();
  const rooms = getRooms();
  const paid = items.filter((item) => item.paymentStatus === "ชำระแล้ว");
  const totalGuests = items.reduce((sum, item) => sum + getGuestCount(item.guestCount), 0);
  const totalDue = items.reduce((sum, item) => sum + Number(item.totalDue || 0), 0);
  const paidTotal = paid.reduce((sum, item) => sum + Number(item.totalDue || 0), 0);
  const fullRooms = rooms.filter((room) => getRoomCapacity(room) > 0 && getRoomUsage(room.id, items) >= getRoomCapacity(room)).length;
  const pendingRoomGuests = items.reduce((sum, item) => sum + getPendingRoomGuests(item), 0);
  adminSummary.innerHTML = `
    <article class="admin-registration-card"><div><strong>ผู้ร่วมงาน ${items.length} รายการ</strong><span>จำนวนเข้าร่วมรวม ${totalGuests} คน • ยอดรวม ${currency.format(totalDue)} บาท • ชำระแล้ว ${currency.format(paidTotal)} บาท</span></div></article>
    <article class="admin-registration-card"><div><strong>ทำเนียบรุ่น ${members.length} รายชื่อ</strong><span>กองร้อย 1-3 ตามข้อมูลในหน้าทำเนียบรุ่น</span></div></article>
    <article class="admin-registration-card"><div><strong>ห้องพัก ${rooms.length} ห้อง</strong><span>เต็มแล้ว ${fullRooms} ห้อง • ยังไม่เต็ม ${Math.max(rooms.length - fullRooms, 0)} ห้อง • ค้างจัด ${pendingRoomGuests} คน</span></div></article>
  `;
};

const resetRoomEditMode = () => {
  editingRoomId = "";
  roomForms.forEach((form) => form.reset());
  roomSubmitButtons.forEach((button) => {
    const form = button.closest("[data-room-form]");
    button.textContent = form?.dataset.roomKind === "family" ? "เพิ่มห้องพักครอบครัว" : "เพิ่มห้องพักปกติ";
  });
};
const renderRoomAdminList = () => {
  if (!roomAdminList || !currentAdmin) return;
  const canManageRooms = ["root", "sub"].includes(currentAdmin.role);
  const rooms = getRooms();
  const registrations = normalizePartyItems();
  if (rooms.length === 0) {
    roomAdminList.textContent = "ยังไม่มีข้อมูลห้องพัก";
    return;
  }
  const groupedRooms = [
    { title: "ห้องพักปกติ", rooms: rooms.filter((room) => !isLargeRoom(room)) },
    { title: "ห้องพักครอบครัว", rooms: rooms.filter((room) => isLargeRoom(room)) }
  ].filter((group) => group.rooms.length > 0);
  roomAdminList.innerHTML = groupedRooms.map((group) => `
    <section class="room-group ${group.rooms.some((room) => isLargeRoom(room)) ? "is-large" : "is-normal"}">
      <div class="room-group-heading">${escapeHtml(group.title)}</div>
      <div class="room-group-grid">
        ${group.rooms.map((room) => {
          const used = getRoomUsage(room.id, registrations);
          const maxGuests = getRoomCapacity(room);
          const remaining = Math.max(maxGuests - used, 0);
          const isFull = maxGuests > 0 && used >= maxGuests;
          const booked = registrations.filter((item) => getRoomBookings(item).some((booking) => booking.roomId === room.id));
          const bookedList = booked.length
            ? booked.map((item) => {
              const bookingGuests = getRoomBookings(item).filter((booking) => booking.roomId === room.id).reduce((sum, booking) => sum + getGuestCount(booking.guests), 0);
              return `<span>${escapeHtml(getDisplayName(item))} (${bookingGuests} คน) ${canManageRooms ? `<button type="button" data-remove-member="${item.id}" data-remove-room="${room.id}">เอาออก</button>` : ""}</span>`;
            }).join("")
            : "ยังไม่มีผู้จอง";
          const availableMembers = canManageRooms ? getAvailableMembers(room, registrations, used) : "";
          return `
            <article class="room-admin-card ${isFull ? "is-full" : "is-open"}">
              <div class="room-admin-image">${renderRoomImages(room, room.roomName)}</div>
              <div class="room-admin-detail">
                <strong>${escapeHtml(getRoomLabel(room))}</strong>
                <span>${escapeHtml(maxGuests || room.maxGuests || "-")} คน • ${escapeHtml(getBedType(room))}${isLargeRoom(room) ? " • " + escapeHtml(room.bedroomCount || 0) + " ห้องนอน • ค่าส่วนต่างห้องครอบครัว " + currency.format(room.largeRoomPrice || 0) + " บาท" : ""} • จองแล้ว ${used} คน • เหลือ ${remaining} คน</span>
                <span class="room-status-badge ${isFull ? "is-full" : "is-open"}">${isFull ? "ห้องเต็ม" : "ยังไม่เต็ม"}</span>
                <div class="room-booked-list">${bookedList}</div>
                <div class="room-assign-control">${canManageRooms ? (isFull ? "<span>ห้องเต็มแล้ว</span>" : availableMembers ? "<span>รายชื่อที่แอดมินจัดเข้าห้องนี้ได้</span>" + availableMembers : "<span>ไม่มีรายชื่อที่ใส่ได้</span>") : "<span>เข้าสู่ระบบ Admin เพื่อจัดการห้องพัก</span>"}</div>
              </div>
              <div class="admin-registration-actions">
                ${canManageRooms ? `<button class="button button--ghost compact-action" type="button" data-edit-room="${room.id}">แก้ไข</button><button class="admin-delete-button" type="button" data-delete-room="${room.id}">ลบ</button>` : ""}
              </div>
            </article>`;
        }).join("")}
      </div>
    </section>
  `).join("");
};
const renderAdminUsers = () => {
  if (!adminUserList || currentAdmin?.role !== "root") return;
  adminUserList.innerHTML = getAdminUsers().map((user) => `
    <article class="admin-registration-card">
      <div><strong>${escapeHtml(user.username)}</strong><span>${user.role === "root" ? "Root Admin" : "Sub Admin"}</span></div>
      <div class="admin-registration-actions">${user.username === "root" ? "" : `<button class="admin-delete-button" type="button" data-delete-admin-user="${user.id}">ลบ</button>`}</div>
    </article>
  `).join("");
};
const applyRole = () => {
  const isRoot = currentAdmin?.role === "root";
  rootOnlySections.forEach((section) => { section.hidden = !isRoot; });
  roomForms.forEach((form) => { form.hidden = false; });
  if (roomPermissionNote) {
    roomPermissionNote.textContent = isRoot ? "Root Admin สามารถจัดการระบบทั้งหมด รวมถึงห้องพัก" : "Sub Admin สามารถลงรายละเอียดห้องพักและจัดผู้ร่วมงานเข้าห้องพักได้";
    roomPermissionNote.classList.remove("is-error");
  }
  renderSummary();
  const settings = getSettings();
  adminSettings.querySelector('[name="eventFee"]').value = settings.eventFee || 0;
  adminSettings.querySelector('[name="shirtPrice"]').value = settings.shirtPrice || 0;
  adminSettings.querySelector('[name="souvenirPrice"]').value = settings.souvenirPrice || 0;
  if (souvenirPreview) {
    souvenirPreview.innerHTML = settings.souvenirImage?.dataUrl
      ? `<img src="${settings.souvenirImage.dataUrl}" alt="รูปของที่ระลึก"><span>${escapeHtml(settings.souvenirImage.name || "รูปของที่ระลึก")}</span>`
      : "ยังไม่มีรูปของที่ระลึก";
  }
  if (isRoot) renderAdminUsers();
  renderRoomAdminList();
};

const unlockAdmin = () => {
  const username = String(adminUserInput.value || "").trim();
  const password = String(adminCodeInput.value || "").trim();
  const users = getAdminUsers();
  const matched = users.find((user) => (username ? user.username === username : true) && user.password === password);
  if (!matched) {
    adminStatus.textContent = "User หรือ Password ไม่ถูกต้อง";
    adminStatus.classList.add("is-error");
    return;
  }
  currentAdmin = matched;
  adminContent.hidden = false;
  adminStatus.textContent = matched.role === "root" ? "เข้าสู่ระบบ Root Admin แล้ว" : "เข้าสู่ระบบ Sub Admin แล้ว: จัดการห้องพักและตรวจสอบระบบ";
  adminStatus.classList.remove("is-error");
  applyRole();
};

adminUnlock.addEventListener("click", unlockAdmin);
[adminUserInput, adminCodeInput].forEach((input) => input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockAdmin();
}));

adminSettings?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!["root", "sub"].includes(currentAdmin?.role)) return;
  const currentSettings = getSettings();
  const souvenirImageFile = adminSettings.querySelector('[name="souvenirImage"]')?.files?.[0];
  if (souvenirImageFile && souvenirImageFile.size > 8 * 1024 * 1024) {
    adminStatus.textContent = "รูปภาพของที่ระลึกต้องมีขนาดไม่เกิน 8 MB ก่อนย่อขนาด";
    adminStatus.classList.add("is-error");
    return;
  }
  const souvenirImage = souvenirImageFile
    ? { name: souvenirImageFile.name, type: souvenirImageFile.type, dataUrl: await readFileAsDataUrl(souvenirImageFile) }
    : currentSettings.souvenirImage;
  const nextSettings = {
    eventFee: Number(adminSettings.querySelector('[name="eventFee"]').value || 0),
    shirtPrice: Number(adminSettings.querySelector('[name="shirtPrice"]').value || 0),
    souvenirPrice: Number(adminSettings.querySelector('[name="souvenirPrice"]').value || 0),
    souvenirImage
  };
  saveSettings(nextSettings);
  siteData.settings = nextSettings;
  recalculatePartyCosts(nextSettings);
  adminStatus.textContent = "บันทึกค่างานเลี้ยงรวมเสื้อตัวที่ 1 และอัปเดตยอดผู้ร่วมงานแล้ว หากใช้งานบน GitHub ให้กดดาวน์โหลดข้อมูลสำหรับ GitHub แล้วอัปทับ site-data.json";
  adminStatus.classList.remove("is-error");
  adminSettings.querySelector('[name="souvenirImage"]').value = "";
  applyRole();
});

adminSettingsReset?.addEventListener("click", () => {
  if (!["root", "sub"].includes(currentAdmin?.role)) return;
  if (!confirm("ยืนยันรีเซ็ตค่างานเลี้ยง ค่าเสื้อ ราคาของที่ระลึก และล้างรูปของที่ระลึก?")) return;
  const resetSettings = { eventFee: 0, shirtPrice: 0, souvenirPrice: 0, souvenirImage: null };
  saveSettings(resetSettings);
  siteData.settings = resetSettings;
  recalculatePartyCosts(resetSettings);
  adminSettings.reset();
  adminSettings.querySelector('[name="eventFee"]').value = 0;
  adminSettings.querySelector('[name="shirtPrice"]').value = 0;
  adminSettings.querySelector('[name="souvenirPrice"]').value = 0;
  adminStatus.textContent = "รีเซ็ตค่าใช้จ่ายงานเลี้ยงแล้ว";
  adminStatus.classList.remove("is-error");
  applyRole();
});


adminExportSiteData?.addEventListener("click", () => {
  if (!["root", "sub"].includes(currentAdmin?.role)) return;
  const data = {
    settings: getSettings(),
    rooms: getRooms(),
    registrations: normalizePartyItems()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "site-data.json";
  link.click();
  URL.revokeObjectURL(url);
  adminStatus.textContent = "ดาวน์โหลด site-data.json แล้ว ให้นำไฟล์นี้ไปอัปทับใน GitHub เพื่อให้ทุกคนเห็นข้อมูลล่าสุด";
  adminStatus.classList.remove("is-error");
});

adminUserForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (currentAdmin?.role !== "root") return;
  const formData = new FormData(adminUserForm);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "sub");
  const users = getAdminUsers();
  const existing = users.find((user) => user.username === username);
  const nextUser = { ...(existing || {}), id: existing?.id || createId("admin"), username, password, role, updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString() };
  saveAdminUsers(existing ? users.map((user) => user.username === username ? nextUser : user) : [nextUser, ...users]);
  adminUserForm.reset();
  adminUserStatus.textContent = "บันทึกบัญชีแอดมินแล้ว";
  adminUserStatus.classList.remove("is-error");
  renderAdminUsers();
});
adminUserList?.addEventListener("click", (event) => {
  const id = event.target.dataset.deleteAdminUser;
  if (!id || currentAdmin?.role !== "root") return;
  const users = getAdminUsers();
  const user = users.find((item) => item.id === id);
  if (!user || user.username === "root") return;
  if (!confirm("ยืนยันลบ Admin " + user.username + "?")) return;
  saveAdminUsers(users.filter((item) => item.id !== id));
  renderAdminUsers();
});

const handleRoomFormSubmit = async (event) => {
  event.preventDefault();
  if (!["root", "sub"].includes(currentAdmin?.role)) return;
  const activeForm = event.currentTarget;
  const roomKind = activeForm.dataset.roomKind || "normal";
  const formData = new FormData(activeForm);
  const imageFiles = formData.getAll("roomImages").filter((file) => file && file.size > 0);
  const rooms = getRooms();
  const current = rooms.find((room) => room.id === editingRoomId);
  const currentImages = getRoomImages(current);
  if (imageFiles.length > 5 || currentImages.length + imageFiles.length > 5) {
    roomStatus.textContent = "รูปภาพห้องพักรวมแล้วต้องไม่เกิน 5 ภาพ";
    roomStatus.classList.add("is-error");
    return;
  }
  if (imageFiles.some((file) => file.size > 8 * 1024 * 1024)) {
    roomStatus.textContent = "รูปภาพแต่ละภาพต้องมีขนาดไม่เกิน 8 MB ก่อนย่อขนาด";
    roomStatus.classList.add("is-error");
    return;
  }
  const rawMaxGuests = parsePositiveNumber(formData.get("maxGuests"));
  const maxGuests = roomKind === "family" ? Math.max(rawMaxGuests || 4, 4) : Math.min(Math.max(rawMaxGuests || 3, 1), 3);
  const newImages = imageFiles.length > 0
    ? await Promise.all(imageFiles.map(async (file) => ({ name: file.name, type: file.type, dataUrl: await readFileAsDataUrl(file) })))
    : [];
  const images = [...currentImages, ...newImages].slice(0, 5);
  const room = {
    ...(current || {}),
    id: editingRoomId || createId("room"),
    roomNumber: String(formData.get("roomNumber") || "").trim(),
    roomName: String(formData.get("roomName") || "").trim(),
    maxGuests,
    bedroomCount: roomKind === "family" ? Math.max(parsePositiveNumber(formData.get("bedroomCount")) || 1, 1) : 0,
    largeRoomPrice: roomKind === "family" ? parsePositiveNumber(formData.get("largeRoomPrice")) : 0,
    bedType: formData.get("bedType"),
    images,
    image: images[0] || null,
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  saveRooms(editingRoomId ? rooms.map((item) => item.id === editingRoomId ? room : item) : [room, ...rooms]);
  roomStatus.textContent = editingRoomId ? "แก้ไขข้อมูลห้องพักเรียบร้อยแล้ว" : "เพิ่มข้อมูลห้องพักเรียบร้อยแล้ว";
  roomStatus.classList.remove("is-error");
  resetRoomEditMode();
  renderRoomAdminList();
  renderSummary();
};
roomForms.forEach((form) => form.addEventListener("submit", handleRoomFormSubmit));
roomCancelButtons.forEach((button) => button.addEventListener("click", () => {
  resetRoomEditMode();
  roomStatus.textContent = "ยกเลิกการแก้ไขห้องพักแล้ว";
  roomStatus.classList.remove("is-error");
}));
roomAdminList?.addEventListener("scroll", (event) => {
  if (event.target.classList?.contains("room-image-gallery")) updateGalleryCounter(event.target);
}, true);
roomAdminList?.addEventListener("click", (event) => {
  if (!["root", "sub"].includes(currentAdmin?.role)) return;
  const scrollButton = event.target.closest("[data-gallery-scroll]");
  if (scrollButton) {
    const gallery = scrollButton.closest(".room-image-slider")?.querySelector(".room-image-gallery");
    if (gallery) {
      const direction = scrollButton.dataset.galleryScroll === "next" ? 1 : -1;
      gallery.scrollBy({ left: direction * gallery.clientWidth, behavior: "smooth" });
      setTimeout(() => updateGalleryCounter(gallery), 260);
    }
    return;
  }
  const removeMemberId = event.target.dataset.removeMember;
  const removeRoomId = event.target.dataset.removeRoom;
  const assignMemberId = event.target.dataset.assignMember;
  const assignRoomId = event.target.dataset.assignRoom;
  const editId = event.target.dataset.editRoom;
  const deleteRoomId = event.target.dataset.deleteRoom;
  const rooms = getRooms();
  if (removeMemberId) {
    const registrations = normalizePartyItems();
    const member = registrations.find((item) => item.id === removeMemberId);
    if (!member) return;
    savePartyItems(registrations.map((item) => {
      if (item.id !== removeMemberId) return item;
      const removedGuests = getRoomBookings(item).filter((booking) => booking.roomId === removeRoomId).reduce((sum, booking) => sum + getGuestCount(booking.guests), 0);
      const roomBookings = getRoomBookings(item).filter((booking) => booking.roomId !== removeRoomId);
      const pendingRoomGuests = getPendingRoomGuests(item) + removedGuests;
      const nextItem = { ...item, roomBookings, roomId: roomBookings[0]?.roomId || "", roomGuestCount: roomBookings[0]?.guests || 0, pendingRoomGuests, largeRoomCharge: getRoomPlan(roomBookings, pendingRoomGuests).largeRoomCharge || 0, updatedAt: new Date().toISOString() };
      return { ...nextItem, totalDue: calculateTotal(nextItem) };
    }));
    roomStatus.textContent = "เอา " + getDisplayName(member) + " ออกจากห้องพักแล้ว";
    roomStatus.classList.remove("is-error");
    renderRoomAdminList();
    renderSummary();
    return;
  }
  if (assignMemberId && assignRoomId) {
    const room = rooms.find((item) => item.id === assignRoomId);
    const registrations = normalizePartyItems();
    const member = registrations.find((item) => item.id === assignMemberId);
    const used = getRoomUsage(assignRoomId, registrations);
    if (!room || !member) return;
    const remaining = Math.max(getRoomCapacity(room) - used, 0);
    const assignGuests = getAssignableGuests(member, remaining, room);
    if (assignGuests <= 0) {
      roomStatus.textContent = "ห้องนี้เต็มหรือไม่มีจำนวนคนที่จัดเข้าได้";
      roomStatus.classList.add("is-error");
      return;
    }
    savePartyItems(registrations.map((item) => {
      if (item.id !== assignMemberId) return item;
      const previousPending = getPendingRoomGuests(item) || Math.max(getGuestCount(item.guestCount) - getRoomBookings(item).reduce((sum, booking) => sum + getGuestCount(booking.guests), 0), 0);
      const roomBookings = [...getRoomBookings(item), { roomId: assignRoomId, guests: assignGuests }];
      const nextItem = { ...item, roomBookings, roomId: roomBookings[0]?.roomId || "", roomGuestCount: roomBookings[0]?.guests || 0, pendingRoomGuests: Math.max(previousPending - assignGuests, 0), largeRoomCharge: getRoomPlan(roomBookings, Math.max(previousPending - assignGuests, 0)).largeRoomCharge || 0, updatedAt: new Date().toISOString() };
      return { ...nextItem, totalDue: calculateTotal(nextItem) };
    }));
    roomStatus.textContent = "จัด " + getDisplayName(member) + " เข้า " + getRoomLabel(room) + " จำนวน " + assignGuests + " คนแล้ว";
    roomStatus.classList.remove("is-error");
    renderRoomAdminList();
    renderSummary();
    return;
  }
  if (editId) {
    const room = rooms.find((item) => item.id === editId);
    if (!room) return;
    editingRoomId = editId;
    roomForms.forEach((form) => form.reset());
    const targetForm = getRoomFormByKind(isLargeRoom(room) ? "family" : "normal");
    targetForm.elements.roomNumber.value = room.roomNumber || "";
    targetForm.elements.roomName.value = room.roomName || "";
    targetForm.elements.maxGuests.value = room.maxGuests || (isLargeRoom(room) ? 4 : 3);
    if (targetForm.elements.bedroomCount) targetForm.elements.bedroomCount.value = room.bedroomCount || 1;
    if (targetForm.elements.largeRoomPrice) targetForm.elements.largeRoomPrice.value = room.largeRoomPrice || 0;
    targetForm.elements.bedType.value = room.bedType || (Number(room.bedCount || 1) > 1 ? "เตียงคู่" : "เตียงเดี่ยว");
    roomSubmitButtons.forEach((button) => {
      const form = button.closest("[data-room-form]");
      button.textContent = form === targetForm ? "บันทึกการแก้ไขห้องพัก" : (form?.dataset.roomKind === "family" ? "เพิ่มห้องพักครอบครัว" : "เพิ่มห้องพักปกติ");
    });
    roomStatus.textContent = "กำลังแก้ไข " + getRoomLabel(room);
    roomStatus.classList.remove("is-error");
    targetForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (deleteRoomId) {
    const room = rooms.find((item) => item.id === deleteRoomId);
    const bookedCount = normalizePartyItems().filter((item) => getRoomBookings(item).some((booking) => booking.roomId === deleteRoomId)).length;
    if (bookedCount > 0) {
      roomStatus.textContent = "ห้องนี้มีผู้จองแล้ว ต้องย้ายหรือลบการจองก่อนจึงจะลบห้องได้";
      roomStatus.classList.add("is-error");
      return;
    }
    if (!confirm("ยืนยันลบ " + getRoomLabel(room) + "?")) return;
    saveRooms(rooms.filter((item) => item.id !== deleteRoomId));
    roomStatus.textContent = "ลบ " + getRoomLabel(room) + " แล้ว";
    roomStatus.classList.remove("is-error");
    renderRoomAdminList();
    renderSummary();
  }
});

const initializeAdminPage = async () => {
  await loadSiteData();
  getAdminUsers();
};
initializeAdminPage();
