const form = document.querySelector("#party-registration");
const statusText = document.querySelector("#form-status");
const totalText = document.querySelector("#payment-total");
const priceDetail = document.querySelector("#party-price-detail");
const souvenirField = document.querySelector("#souvenir-field");
const souvenirLabel = document.querySelector("#souvenir-label");
const souvenirPublicImage = document.querySelector("#souvenir-public-image");
const submitButton = document.querySelector("#party-submit-button");
const roomSelect = document.querySelector("#party-room-select");
const roomBookingNote = document.querySelector("#room-booking-note");
const publicRoomList = document.querySelector("#room-public-list");
const roomLightbox = document.querySelector("#room-image-lightbox");
const roomLightboxImage = document.querySelector("#room-image-lightbox-img");
const roomLightboxClose = document.querySelector("#room-image-lightbox-close");
const roomLightboxPrev = document.querySelector("#room-image-lightbox-prev");
const roomLightboxNext = document.querySelector("#room-image-lightbox-next");
const roomLightboxCounter = document.querySelector("#room-image-lightbox-counter");
const adminCodeInput = document.querySelector("#party-admin-code");
const adminUnlock = document.querySelector("#party-admin-unlock");
const adminStatus = document.querySelector("#party-admin-status");
const adminList = document.querySelector("#party-admin-list");

const storageKey = "cavalry3040PartyRegistrations";
const settingsKey = "cavalry3040PartySettings";
const roomsKey = "cavalry3040PartyRooms";
const adminPin = "cavalry3040";
const currency = new Intl.NumberFormat("th-TH");
let editingPartyId = "";
let adminUnlocked = false;
let lightboxImages = [];
let lightboxIndex = 0;

const createId = (prefix) => globalThis.crypto?.randomUUID?.() || prefix + "-" + Date.now();
const getSettings = () => ({ eventFee: 0, shirtPrice: 0, souvenirPrice: 0, souvenirImage: null, ...JSON.parse(localStorage.getItem(settingsKey) || "{}") });
const getRegistrations = () => JSON.parse(localStorage.getItem(storageKey) || "[]").map((item, index) => ({
  ...item,
  id: item.id || "legacy-party-" + index + "-" + (item.registeredAt || index)
}));
const saveRegistrations = (items) => localStorage.setItem(storageKey, JSON.stringify(items));
const getRooms = () => JSON.parse(localStorage.getItem(roomsKey) || "[]").map((room, index) => ({
  ...room,
  id: room.id || "legacy-room-" + index + "-" + (room.createdAt || index)
}));
const normalizeName = (firstName, lastName) => String((firstName || "") + " " + (lastName || "")).replace(/\s+/g, " ").trim().toLocaleLowerCase("th-TH");
const hasDuplicateName = (items, firstName, lastName, currentId = "") => {
  const targetName = normalizeName(firstName, lastName);
  return items.some((item) => item.id !== currentId && normalizeName(item.firstName, item.lastName) === targetName);
};

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));

const getDisplayName = (item, fallback = "รายการนี้") => {
  const displayName = [item?.rank, item?.firstName, item?.lastName].filter(Boolean).join(" ").trim();
  return displayName || fallback;
};

const getPriceParts = (shirtCount, souvenirReserved = false, settings = getSettings()) => {
  const shirts = Number(shirtCount || 0);
  const paidShirts = Math.max(shirts - 1, 0);
  const eventFee = Number(settings.eventFee || 0);
  const shirtPrice = Number(settings.shirtPrice || 0);
  const souvenirPrice = Number(settings.souvenirPrice || 0);
  const extraShirtTotal = paidShirts * shirtPrice;
  const souvenirTotal = souvenirReserved && souvenirPrice > 0 ? souvenirPrice : 0;
  return { eventFee, shirtPrice, paidShirts, extraShirtTotal, souvenirPrice, souvenirTotal, total: eventFee + extraShirtTotal + souvenirTotal };
};

const calculateTotal = (shirtCount, settings = getSettings(), souvenirReserved = false) => getPriceParts(shirtCount, souvenirReserved, settings).total;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const parsePositiveNumber = (value) => {
  const normalized = String(value || "").replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit)).replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
};

const getRoomCapacity = (room) => parsePositiveNumber(room?.maxGuests ?? room?.guestCount ?? room?.capacity);
const getGuestCount = (value) => parsePositiveNumber(value);
const getRequestedGuests = () => Math.max(getGuestCount(form.elements.guestCount?.value), 1);

const getRoomUsage = (roomId, registrations = getRegistrations(), excludedRegistrationId = "") => registrations
  .filter((item) => item.roomId === roomId && item.id !== excludedRegistrationId)
  .reduce((sum, item) => sum + getGuestCount(item.guestCount), 0);

const getRoomLabel = (room) => room ? "ห้อง " + room.roomNumber + " - " + room.roomName : "-";
const getRoomVacancy = (room, registrations = getRegistrations(), excludedRegistrationId = "") => {
  if (!room) return 0;
  const used = getRoomUsage(room.id, registrations, excludedRegistrationId);
  return Math.max(getRoomCapacity(room) - used, 0);
};
const getRoomStatus = (room, registrations = getRegistrations()) => {
  if (!room) return "-";
  const vacancy = getRoomVacancy(room, registrations);
  return vacancy > 0 ? "ว่าง " + vacancy + " คน" : "เต็มแล้ว";
};
const renderPaymentProof = (proof) => {
  if (!proof || !proof.dataUrl) return "ไม่มีหลักฐาน";
  const fileName = escapeHtml(proof.name || "หลักฐานชำระเงิน");
  const fileUrl = escapeHtml(proof.dataUrl);
  return "<a class=\"proof-link\" href=\"" + fileUrl + "\" target=\"_blank\" rel=\"noopener\" download=\"" + fileName + "\">ดูหลักฐาน</a>";
};
const getBedType = (room) => room?.bedType || (room?.bedCount ? room.bedCount + " เตียงนอน" : "-");
const getRoomImages = (room) => {
  if (Array.isArray(room?.images) && room.images.length > 0) return room.images;
  if (room?.image?.dataUrl) return [room.image];
  return [];
};
const renderRoomImages = (room, altText) => {
  const images = getRoomImages(room).slice(0, 5);
  if (images.length === 0) return `<div class="room-image-placeholder">ไม่มีรูป</div>`;
  const gallery = `<div class="room-image-gallery">${images.map((image, index) => `<button class="room-image-zoom" type="button" data-room-image="${escapeHtml(image.dataUrl)}" data-room-image-alt="${escapeHtml(altText)} ภาพที่ ${index + 1}" data-gallery-index="${index}"><img src="${image.dataUrl}" alt="${escapeHtml(altText)} ภาพที่ ${index + 1}"></button>`).join("")}</div>`;
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

const showLightboxImage = () => {
  const item = lightboxImages[lightboxIndex];
  if (!item || !roomLightboxImage) return;
  roomLightboxImage.src = item.src;
  roomLightboxImage.alt = item.alt || "ภาพห้องพักขนาดใหญ่";
  if (roomLightboxCounter) roomLightboxCounter.textContent = (lightboxIndex + 1) + "/" + lightboxImages.length;
};

const moveLightboxImage = (direction) => {
  if (lightboxImages.length <= 1) return;
  lightboxIndex = (lightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
  showLightboxImage();
};

const openRoomImage = (images, index = 0) => {
  if (!roomLightbox || !roomLightboxImage) return;
  lightboxImages = images.length ? images : [];
  lightboxIndex = Math.max(0, Math.min(index, lightboxImages.length - 1));
  showLightboxImage();
  roomLightbox.hidden = false;
  document.body.classList.add("has-lightbox");
};

const closeRoomImage = () => {
  if (!roomLightbox || !roomLightboxImage) return;
  roomLightbox.hidden = true;
  roomLightboxImage.removeAttribute("src");
  lightboxImages = [];
  lightboxIndex = 0;
  document.body.classList.remove("has-lightbox");
};

const updateRoomSelect = () => {
  const rooms = getRooms();
  const registrations = getRegistrations();
  const currentRoomId = roomSelect.value;

  if (rooms.length === 0) {
    roomSelect.innerHTML = "<option value=\"\">ไม่จองห้องพัก</option>";
    roomBookingNote.textContent = "ยังไม่มีข้อมูลห้องพักจากแอดมิน";
    return;
  }

  roomSelect.innerHTML = "<option value=\"\">ไม่จองห้องพัก</option>" + rooms.map((room) => {
    const used = getRoomUsage(room.id, registrations, editingPartyId);
    const maxGuests = getRoomCapacity(room);
    const remaining = Math.max(maxGuests - used, 0);
    const full = maxGuests > 0 && remaining <= 0;
    const selected = currentRoomId === room.id ? "selected" : "";
    return `<option value="${room.id}" ${selected} ${full && !selected ? "disabled" : ""}>${escapeHtml(getRoomLabel(room))} (ว่าง ${remaining} คน)</option>`;
  }).join("");

  const selectedRoom = rooms.find((room) => room.id === currentRoomId);
  roomBookingNote.textContent = selectedRoom
    ? "เลือก " + getRoomLabel(selectedRoom) + " แล้ว กดส่งข้อมูลลงทะเบียนเพื่อยืนยันการจอง"
    : "เลือกห้องจากรายการห้องพักด้านล่าง ระบบจะเช็กจำนวนผู้เข้าพักให้ก่อนบันทึก";
};

const renderPublicRooms = () => {
  const rooms = getRooms();
  const registrations = getRegistrations();

  if (!publicRoomList) return;
  if (rooms.length === 0) {
    publicRoomList.textContent = "รอแอดมินเพิ่มข้อมูลห้องพัก";
    return;
  }

  publicRoomList.innerHTML = rooms.map((room) => {
    const used = getRoomUsage(room.id, registrations, editingPartyId);
    const maxGuests = getRoomCapacity(room);
    const remaining = Math.max(maxGuests - used, 0);
    const requestedGuests = getRequestedGuests();
    const full = maxGuests > 0 && remaining <= 0;
    const hasEnoughSpace = maxGuests === 0 || remaining >= requestedGuests;
    const selected = roomSelect.value === room.id;
    const disabled = !selected && (full || !hasEnoughSpace);
    const image = renderRoomImages(room, room.roomName);
    const buttonText = selected ? "เลือกห้องนี้แล้ว" : full ? "ห้องเต็ม" : !hasEnoughSpace ? "ว่างไม่พอ" : "เลือกจองห้องนี้";
    return `
      <article class="room-public-card ${selected ? "is-selected" : ""}">
        <div class="room-public-image">${image}</div>
        <div class="room-public-body">
          <div class="room-summary-heading">
            <strong>${escapeHtml(getRoomLabel(room))}</strong>
            <span>ว่าง ${remaining} คน</span>
          </div>
          <p>${escapeHtml(getBedType(room))} • รองรับ ${escapeHtml(maxGuests || room.maxGuests || "-")} คน • จองแล้ว ${used} คน</p>
          <button class="button ${selected ? "button--primary" : "button--ghost"} compact-action" type="button" data-book-room="${room.id}" ${disabled ? "disabled" : ""}>${buttonText}</button>
        </div>
      </article>
    `;
  }).join("");
};

const updateTotalPreview = () => {
  const formData = new FormData(form);
  const settings = getSettings();
  const souvenirPrice = Number(settings.souvenirPrice || 0);
  const souvenirReserved = formData.get("souvenirReserved") === "yes" && souvenirPrice > 0;
  const parts = getPriceParts(formData.get("shirtCount"), souvenirReserved, settings);

  if (souvenirField) souvenirField.hidden = souvenirPrice <= 0;
  if (souvenirLabel) souvenirLabel.textContent = "จองของที่ระลึก ราคา " + currency.format(souvenirPrice) + " บาท";
  if (souvenirPublicImage) {
    const image = settings.souvenirImage;
    souvenirPublicImage.hidden = !(souvenirPrice > 0 && image?.dataUrl);
    souvenirPublicImage.innerHTML = image?.dataUrl ? `<img src="${image.dataUrl}" alt="รูปของที่ระลึก">` : "";
  }
  if (priceDetail) {
    const rows = [
      `<span>ค่างานเลี้ยงรวมเสื้อตัวที่ 1: ${currency.format(parts.eventFee)} บาท</span>`,
      `<span>เสื้อตัวที่ 2 ขึ้นไป: ${currency.format(parts.shirtPrice)} บาท/ตัว (${parts.paidShirts} ตัว = ${currency.format(parts.extraShirtTotal)} บาท)</span>`
    ];
    if (souvenirPrice > 0) rows.push(`<span>ของที่ระลึก: ${currency.format(souvenirPrice)} บาท${souvenirReserved ? " (จองแล้ว)" : ""}</span>`);
    priceDetail.innerHTML = rows.join("");
  }

  totalText.textContent = `ยอดต้องชำระ: ${currency.format(parts.total)} บาท`;
  updateRoomSelect();
  renderPublicRooms();
};

const resetEditMode = () => {
  editingPartyId = "";
  submitButton.textContent = "ส่งข้อมูลลงทะเบียน";
  updateRoomSelect();
};

const setSizes = (sizes) => {
  form.querySelectorAll("input[name=\"shirtSize\"]").forEach((input) => {
    input.checked = Array.isArray(sizes) && sizes.includes(input.value);
  });
};

const renderAdminList = () => {
  if (!adminUnlocked) return;
  const items = getRegistrations();
  const rooms = getRooms();
  adminList.hidden = false;

  if (items.length === 0) {
    adminList.textContent = "ยังไม่มีข้อมูลผู้ร่วมงาน";
    return;
  }

  adminList.innerHTML = items.map((item) => {
    const room = rooms.find((entry) => entry.id === item.roomId);
    const shirtSizes = Array.isArray(item.shirtSizes) ? item.shirtSizes.map(escapeHtml).join(", ") : "-";
    const paymentStatus = item.paymentStatus || "ยังไม่ชำระ";
    const souvenirText = item.souvenirReserved ? " • ของที่ระลึก: จอง" : "";
    return `
      <article class="admin-registration-card admin-registration-card--detailed">
        <div class="admin-registration-detail">
          <strong>${escapeHtml(getDisplayName(item))}</strong>
          <span>สังกัด: ${escapeHtml(item.unit || "-")} • เบอร์โทร: ${escapeHtml(item.phone || "-")}</span>
          <span>จำนวนเข้าร่วม: ${escapeHtml(item.guestCount || 0)} คน • เสื้อ: ${escapeHtml(item.shirtCount || 0)} ตัว • ไซส์: ${shirtSizes}${souvenirText}</span>
          <span>ยอดต้องชำระ: ${currency.format(item.totalDue || 0)} บาท • สถานะชำระเงิน: ${escapeHtml(paymentStatus)} • ${renderPaymentProof(item.paymentProof)}</span>
          <span>ห้องพัก: ${escapeHtml(getRoomLabel(room))} • สถานะห้องพัก: ${escapeHtml(getRoomStatus(room, items))}</span>
        </div>
        <div class="admin-registration-actions">
          <select data-payment-status="${item.id}" aria-label="สถานะชำระเงินของ ${escapeHtml(getDisplayName(item))}">
            <option value="ยังไม่ชำระ" ${paymentStatus === "ยังไม่ชำระ" ? "selected" : ""}>ยังไม่ชำระ</option>
            <option value="รอตรวจสอบ" ${paymentStatus === "รอตรวจสอบ" ? "selected" : ""}>รอตรวจสอบ</option>
            <option value="ชำระแล้ว" ${paymentStatus === "ชำระแล้ว" ? "selected" : ""}>ชำระแล้ว</option>
          </select>
          <button class="button button--primary compact-action" type="button" data-update-payment="${item.id}">อัปเดต</button>
          <button class="button button--ghost compact-action" type="button" data-edit-party="${item.id}">แก้ไข</button>
          <button class="admin-delete-button" type="button" data-delete-party="${item.id}">ลบ</button>
        </div>
      </article>
    `;
  }).join("");
};

form.addEventListener("input", updateTotalPreview);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const selectedSizes = formData.getAll("shirtSize");
  const proofFile = formData.get("paymentProof");
  const selectedRoomId = String(formData.get("roomId") || "");

  if (selectedSizes.length === 0) {
    statusText.textContent = "กรุณาเลือกไซส์เสื้ออย่างน้อย 1 ไซส์";
    statusText.classList.add("is-error");
    return;
  }

  const hasProofFile = proofFile && proofFile.size > 0;

  if (hasProofFile && proofFile.size > 2 * 1024 * 1024) {
    statusText.textContent = "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 2 MB";
    statusText.classList.add("is-error");
    return;
  }

  const existing = getRegistrations();
  const current = existing.find((item) => item.id === editingPartyId);
  const rank = String(formData.get("rank") || "").trim();
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const guestCount = getGuestCount(formData.get("guestCount"));

  if (hasDuplicateName(existing, firstName, lastName, editingPartyId)) {
    statusText.textContent = "มีชื่อและนามสกุลนี้ลงทะเบียนงานเลี้ยงแล้ว กรุณาตรวจสอบข้อมูลอีกครั้ง";
    statusText.classList.add("is-error");
    return;
  }

  if (selectedRoomId) {
    const room = getRooms().find((item) => item.id === selectedRoomId);
    const used = getRoomUsage(selectedRoomId, existing, editingPartyId);
    if (!room) {
      statusText.textContent = "ไม่พบข้อมูลห้องพักที่เลือก กรุณาเลือกใหม่อีกครั้ง";
      statusText.classList.add("is-error");
      return;
    }
    const maxGuests = getRoomCapacity(room);
    if (maxGuests > 0 && used + guestCount > maxGuests) {
      statusText.textContent = "ห้องพักนี้รองรับได้อีก " + Math.max(maxGuests - used, 0) + " คน กรุณาเลือกห้องอื่น";
      statusText.classList.add("is-error");
      return;
    }
  }

  const settings = getSettings();
  const proofDataUrl = hasProofFile ? await readFileAsDataUrl(proofFile) : "";
  const registration = {
    ...(current || {}),
    id: editingPartyId || createId("party"),
    rank,
    firstName,
    lastName,
    phone: String(formData.get("phone") || "").trim(),
    unit: String(formData.get("unit") || "").trim(),
    guestCount: formData.get("guestCount"),
    shirtCount: formData.get("shirtCount"),
    shirtSizes: selectedSizes,
    roomId: selectedRoomId,
    souvenirReserved: formData.get("souvenirReserved") === "yes" && Number(settings.souvenirPrice || 0) > 0,
    eventFee: Number(settings.eventFee || 0),
    shirtPrice: Number(settings.shirtPrice || 0),
    souvenirPrice: Number(settings.souvenirPrice || 0),
    totalDue: calculateTotal(formData.get("shirtCount"), settings, formData.get("souvenirReserved") === "yes"),
    paymentStatus: current?.paymentStatus || (hasProofFile ? "รอตรวจสอบ" : "ยังไม่ชำระ"),
    paymentProof: hasProofFile ? { name: proofFile.name, type: proofFile.type, dataUrl: proofDataUrl } : (current?.paymentProof || null),
    registeredAt: current?.registeredAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const next = editingPartyId
    ? existing.map((item) => item.id === editingPartyId ? registration : item)
    : [registration, ...existing];
  saveRegistrations(next);

  statusText.classList.remove("is-error");
  statusText.textContent = editingPartyId ? "แก้ไขข้อมูลผู้ร่วมงานเรียบร้อยแล้ว" : "บันทึกข้อมูลเรียบร้อยแล้ว หากแนบหลักฐานแล้วจะรอแอดมินตรวจสอบการชำระเงิน";
  form.reset();
  resetEditMode();
  updateTotalPreview();
  renderAdminList();
  renderPublicRooms();
});

adminUnlock.addEventListener("click", () => {
  if (adminCodeInput.value !== adminPin) {
    adminStatus.textContent = "รหัสผ่าน Admin ไม่ถูกต้อง";
    adminStatus.classList.add("is-error");
    return;
  }
  adminUnlocked = true;
  adminStatus.textContent = "ปลดล็อกการจัดการผู้ร่วมงานแล้ว";
  adminStatus.classList.remove("is-error");
  renderAdminList();
});

adminList.addEventListener("change", (event) => {
  const id = event.target.dataset.paymentStatus;
  if (!id) return;
  adminStatus.textContent = "เลือกสถานะใหม่แล้ว กรุณากดปุ่มอัปเดตเพื่อบันทึก";
  adminStatus.classList.remove("is-error");
});

adminList.addEventListener("click", (event) => {
  const updatePaymentId = event.target.dataset.updatePayment;
  const editId = event.target.dataset.editParty;
  const deleteId = event.target.dataset.deleteParty;
  const items = getRegistrations();

  if (updatePaymentId) {
    const statusSelect = Array.from(adminList.querySelectorAll("[data-payment-status]")).find((select) => select.dataset.paymentStatus === updatePaymentId);
    if (!statusSelect) return;
    const member = items.find((entry) => entry.id === updatePaymentId);
    const displayName = getDisplayName(member);
    saveRegistrations(items.map((entry) => entry.id === updatePaymentId ? { ...entry, paymentStatus: statusSelect.value, updatedAt: new Date().toISOString() } : entry));
    renderAdminList();
    adminStatus.textContent = "อัปเดตสถานะการจ่ายเงินของ " + displayName + " แล้ว";
    adminStatus.classList.remove("is-error");
    return;
  }

  if (editId) {
    const item = items.find((entry) => entry.id === editId);
    if (!item) return;
    editingPartyId = editId;
    form.elements.rank.value = item.rank || "";
    form.elements.firstName.value = item.firstName || "";
    form.elements.lastName.value = item.lastName || "";
    form.elements.phone.value = item.phone || "";
    form.elements.unit.value = item.unit || "";
    form.elements.guestCount.value = item.guestCount || 1;
    form.elements.shirtCount.value = item.shirtCount || 0;
    setSizes(item.shirtSizes || []);
    roomSelect.value = item.roomId || "";
    if (form.elements.souvenirReserved) form.elements.souvenirReserved.checked = Boolean(item.souvenirReserved);
    submitButton.textContent = "บันทึกการแก้ไข";
    statusText.textContent = "กำลังแก้ไขข้อมูลของ " + getDisplayName(item);
    statusText.classList.remove("is-error");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    updateTotalPreview();
    renderPublicRooms();
    return;
  }

  if (deleteId) {
    const item = items.find((entry) => entry.id === deleteId);
    const displayName = getDisplayName(item);
    if (!confirm("ยืนยันลบผู้ร่วมงาน " + displayName + "?")) return;
    saveRegistrations(items.filter((entry) => entry.id !== deleteId));
    renderAdminList();
    renderPublicRooms();
    adminStatus.textContent = "ลบผู้ร่วมงาน " + displayName + " แล้ว";
    adminStatus.classList.remove("is-error");
  }
});

if (publicRoomList) {
  publicRoomList.addEventListener("click", (event) => {
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

    const zoomButton = event.target.closest("[data-room-image]");
    if (zoomButton) {
      const galleryItems = Array.from(zoomButton.closest(".room-image-gallery")?.querySelectorAll("[data-room-image]") || []);
      const images = galleryItems.map((item) => ({ src: item.dataset.roomImage, alt: item.dataset.roomImageAlt }));
      openRoomImage(images, Number(zoomButton.dataset.galleryIndex || 0));
      return;
    }

    const roomButton = event.target.closest("[data-book-room]");
    const roomId = roomButton?.dataset.bookRoom;
    if (!roomId) return;
    roomSelect.value = roomId;
    updateRoomSelect();
    roomBookingNote.textContent = "เลือกห้องพักแล้ว กรุณากรอกข้อมูลและกดส่งข้อมูลลงทะเบียนเพื่อยืนยันการจอง";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    renderPublicRooms();
  });
}

if (roomLightboxClose) {
  roomLightboxClose.addEventListener("click", closeRoomImage);
}

if (roomLightboxPrev) {
  roomLightboxPrev.addEventListener("click", () => moveLightboxImage(-1));
}

if (roomLightboxNext) {
  roomLightboxNext.addEventListener("click", () => moveLightboxImage(1));
}

if (roomLightbox) {
  roomLightbox.addEventListener("click", (event) => {
    if (event.target === roomLightbox) closeRoomImage();
  });
}

document.addEventListener("keydown", (event) => {
  if (!roomLightbox || roomLightbox.hidden) return;
  if (event.key === "Escape") closeRoomImage();
  if (event.key === "ArrowLeft") moveLightboxImage(-1);
  if (event.key === "ArrowRight") moveLightboxImage(1);
});

if (publicRoomList) {
  publicRoomList.addEventListener("scroll", (event) => {
    if (event.target.classList?.contains("room-image-gallery")) updateGalleryCounter(event.target);
  }, true);
}

roomSelect.addEventListener("change", renderPublicRooms);

updateTotalPreview();
renderPublicRooms();
