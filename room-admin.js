const adminCodeInput = document.querySelector("#room-admin-code");
const adminUnlock = document.querySelector("#room-admin-unlock");
const adminStatus = document.querySelector("#room-admin-status");
const adminContent = document.querySelector("#room-admin-content");
const roomForm = document.querySelector("#room-admin-form");
const roomStatus = document.querySelector("#room-status");
const roomSubmitButton = document.querySelector("#room-submit-button");
const roomCancelButton = document.querySelector("#room-cancel-button");
const roomAdminList = document.querySelector("#room-admin-list");

const roomsKey = "cavalry3040PartyRooms";
const registrationsKey = "cavalry3040PartyRegistrations";
const adminPin = "cavalry3040";
let adminUnlocked = false;
let editingRoomId = "";

const createId = (prefix) => globalThis.crypto?.randomUUID?.() || prefix + "-" + Date.now();
const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));

const getRooms = () => JSON.parse(localStorage.getItem(roomsKey) || "[]").map((room, index) => ({
  ...room,
  id: room.id || "legacy-room-" + index + "-" + (room.createdAt || index)
}));
const saveRooms = (rooms) => localStorage.setItem(roomsKey, JSON.stringify(rooms));
const saveRegistrations = (items) => localStorage.setItem(registrationsKey, JSON.stringify(items));
const getRegistrations = () => JSON.parse(localStorage.getItem(registrationsKey) || "[]").map((item, index) => ({
  ...item,
  id: item.id || "legacy-party-" + index + "-" + (item.registeredAt || index)
}));

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

const parsePositiveNumber = (value) => {
  const normalized = String(value || "").replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit)).replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
};

const getRoomCapacity = (room) => parsePositiveNumber(room?.maxGuests ?? room?.guestCount ?? room?.capacity);
const getGuestCount = (value) => parsePositiveNumber(value);

const getRoomUsage = (roomId, registrations = getRegistrations()) => registrations
  .filter((item) => item.roomId === roomId)
  .reduce((sum, item) => sum + getGuestCount(item.guestCount), 0);

const getRoomLabel = (room) => room ? "ห้อง " + room.roomNumber + " - " + room.roomName : "-";
const getBedType = (room) => room?.bedType || (room?.bedCount ? room.bedCount + " เตียงนอน" : "-");
const getDisplayName = (item) => [item?.rank, item?.firstName, item?.lastName].filter(Boolean).join(" ").trim() || "ไม่ระบุชื่อ";
const getRoomImages = (room) => {
  if (Array.isArray(room?.images) && room.images.length > 0) return room.images;
  if (room?.image?.dataUrl) return [room.image];
  return [];
};
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

const getAvailableMembers = (room, registrations, used) => registrations
  .filter((item) => item.roomId !== room.id && used + getGuestCount(item.guestCount) <= getRoomCapacity(room))
  .map((item) => {
    const roomText = item.roomId ? "ย้ายเข้าห้องนี้" : "ยังไม่จอง - จัดเข้าห้องนี้";
    return `<button class="button button--ghost compact-action" type="button" data-assign-member="${item.id}" data-assign-room="${room.id}">${escapeHtml(getDisplayName(item))} (${escapeHtml(item.guestCount || 0)} คน) • ${roomText}</button>`;
  })
  .join("");

const resetRoomEditMode = () => {
  editingRoomId = "";
  roomForm.reset();
  roomSubmitButton.textContent = "เพิ่มห้องพัก";
};

const renderRoomAdminList = () => {
  if (!adminUnlocked) return;
  const rooms = getRooms();
  const registrations = getRegistrations();

  if (rooms.length === 0) {
    roomAdminList.textContent = "ยังไม่มีข้อมูลห้องพัก";
    return;
  }

  roomAdminList.innerHTML = rooms.map((room) => {
    const used = getRoomUsage(room.id, registrations);
    const maxGuests = getRoomCapacity(room);
    const remaining = Math.max(maxGuests - used, 0);
    const isFull = maxGuests > 0 && used >= maxGuests;
    const booked = registrations.filter((item) => item.roomId === room.id);
    const bookedList = booked.length
      ? booked.map((item) => `<span>${escapeHtml(getDisplayName(item))} (${escapeHtml(item.guestCount || 0)} คน) <button type="button" data-remove-member="${item.id}">เอาออก</button></span>`).join("")
      : "ยังไม่มีผู้จอง";
    const availableMembers = getAvailableMembers(room, registrations, used);
    const image = renderRoomImages(room, room.roomName);
    return `
      <article class="room-admin-card ${isFull ? "is-full" : "is-open"}">
        <div class="room-admin-image">${image}</div>
        <div class="room-admin-detail">
          <strong>${escapeHtml(getRoomLabel(room))}</strong>
          <span>${escapeHtml(maxGuests || room.maxGuests || "-")} คน • ${escapeHtml(getBedType(room))} • จองแล้ว ${used} คน • เหลือ ${remaining} คน</span>
          <span class="room-status-badge ${isFull ? "is-full" : "is-open"}">${isFull ? "ห้องเต็ม" : "ยังไม่เต็ม"}</span>
          <div class="room-booked-list">${bookedList}</div>
          <div class="room-assign-control">
            ${isFull ? "<span>ห้องเต็มแล้ว</span>" : availableMembers ? "<span>รายชื่อที่แอดมินจัดเข้าห้องนี้ได้</span>" + availableMembers : "<span>ไม่มีรายชื่อที่ใส่ได้</span>"}
          </div>
        </div>
        <div class="admin-registration-actions">
          <button class="button button--ghost compact-action" type="button" data-edit-room="${room.id}">แก้ไข</button>
          <button class="admin-delete-button" type="button" data-delete-room="${room.id}">ลบ</button>
        </div>
      </article>
    `;
  }).join("");
};

adminUnlock.addEventListener("click", () => {
  if (adminCodeInput.value !== adminPin) {
    adminStatus.textContent = "รหัสผ่าน Admin ไม่ถูกต้อง";
    adminStatus.classList.add("is-error");
    return;
  }

  adminUnlocked = true;
  adminContent.hidden = false;
  adminStatus.textContent = "ปลดล็อกการจัดการห้องพักแล้ว";
  adminStatus.classList.remove("is-error");
  renderRoomAdminList();
});

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!adminUnlocked) {
    adminStatus.textContent = "กรุณาเข้าสู่ระบบ Admin ก่อนจัดการห้องพัก";
    adminStatus.classList.add("is-error");
    return;
  }
  const formData = new FormData(roomForm);
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

  const newImages = imageFiles.length > 0
    ? await Promise.all(imageFiles.map(async (file) => ({ name: file.name, type: file.type, dataUrl: await readFileAsDataUrl(file) })))
    : [];
  const images = [...currentImages, ...newImages].slice(0, 5);
  const room = {
    ...(current || {}),
    id: editingRoomId || createId("room"),
    roomNumber: String(formData.get("roomNumber") || "").trim(),
    roomName: String(formData.get("roomName") || "").trim(),
    maxGuests: formData.get("maxGuests"),
    bedType: formData.get("bedType"),
    images,
    image: images[0] || null,
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const next = editingRoomId
    ? rooms.map((item) => item.id === editingRoomId ? room : item)
    : [room, ...rooms];
  saveRooms(next);
  roomStatus.textContent = editingRoomId ? "แก้ไขข้อมูลห้องพักเรียบร้อยแล้ว" : "เพิ่มข้อมูลห้องพักเรียบร้อยแล้ว";
  roomStatus.classList.remove("is-error");
  resetRoomEditMode();
  renderRoomAdminList();
});

roomCancelButton.addEventListener("click", () => {
  if (!adminUnlocked) return;
  resetRoomEditMode();
  roomStatus.textContent = "ยกเลิกการแก้ไขห้องพักแล้ว";
  roomStatus.classList.remove("is-error");
});

roomAdminList.addEventListener("scroll", (event) => {
  if (event.target.classList?.contains("room-image-gallery")) updateGalleryCounter(event.target);
}, true);

roomAdminList.addEventListener("click", (event) => {
  if (!adminUnlocked) return;
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
  const assignMemberId = event.target.dataset.assignMember;
  const assignRoomId = event.target.dataset.assignRoom;
  const editId = event.target.dataset.editRoom;
  const deleteRoomId = event.target.dataset.deleteRoom;
  const rooms = getRooms();

  if (removeMemberId) {
    const registrations = getRegistrations();
    const member = registrations.find((item) => item.id === removeMemberId);
    if (!member) return;
    saveRegistrations(registrations.map((item) => item.id === removeMemberId ? { ...item, roomId: "", updatedAt: new Date().toISOString() } : item));
    roomStatus.textContent = "เอา " + getDisplayName(member) + " ออกจากห้องพักแล้ว";
    roomStatus.classList.remove("is-error");
    renderRoomAdminList();
    return;
  }

  if (assignMemberId && assignRoomId) {
    const room = rooms.find((item) => item.id === assignRoomId);
    if (!room) return;
    const registrations = getRegistrations();
    const member = registrations.find((item) => item.id === assignMemberId);
    const used = getRoomUsage(assignRoomId, registrations);
    if (!member) return;
    if (used + getGuestCount(member.guestCount) > getRoomCapacity(room)) {
      roomStatus.textContent = "ห้องนี้จะเกินจำนวนผู้เข้าพักที่กำหนด";
      roomStatus.classList.add("is-error");
      return;
    }
    saveRegistrations(registrations.map((item) => item.id === assignMemberId ? { ...item, roomId: assignRoomId, updatedAt: new Date().toISOString() } : item));
    roomStatus.textContent = "จัด " + getDisplayName(member) + " เข้า " + getRoomLabel(room) + " แล้ว";
    roomStatus.classList.remove("is-error");
    renderRoomAdminList();
    return;
  }

  if (editId) {
    const room = rooms.find((item) => item.id === editId);
    if (!room) return;
    editingRoomId = editId;
    roomForm.elements.roomNumber.value = room.roomNumber || "";
    roomForm.elements.roomName.value = room.roomName || "";
    roomForm.elements.maxGuests.value = room.maxGuests || 1;
    roomForm.elements.bedType.value = room.bedType || (Number(room.bedCount || 1) > 1 ? "เตียงคู่" : "เตียงเดี่ยว");
    roomSubmitButton.textContent = "บันทึกการแก้ไขห้องพัก";
    roomStatus.textContent = "กำลังแก้ไข " + getRoomLabel(room);
    roomStatus.classList.remove("is-error");
    roomForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (deleteRoomId) {
    const room = rooms.find((item) => item.id === deleteRoomId);
    const bookedCount = getRegistrations().filter((item) => item.roomId === deleteRoomId).length;
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
  }
});
