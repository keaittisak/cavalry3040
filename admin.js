const adminCodeInput = document.querySelector("#admin-code");
const adminUnlock = document.querySelector("#admin-unlock");
const adminStatus = document.querySelector("#admin-status");
const adminContent = document.querySelector("#admin-content");
const adminSettings = document.querySelector("#admin-settings");
const partyForm = document.querySelector("#admin-party-form");
const partyList = document.querySelector("#admin-registrations");
const partySubmit = document.querySelector("#admin-party-submit");
const directoryForm = document.querySelector("#admin-directory-form");
const directoryList = document.querySelector("#admin-directory-members");
const directorySubmit = document.querySelector("#admin-directory-submit");

const adminPin = "cavalry3040";
const partyKey = "cavalry3040PartyRegistrations";
const settingsKey = "cavalry3040PartySettings";
const directoryKey = "cavalry3040DirectoryMembers";
const currency = new Intl.NumberFormat("th-TH");
let editingPartyId = "";
let editingMemberId = "";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    console.warn("Reset invalid localStorage data for", key, error);
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
};

const getSettings = () => readJson(settingsKey, { eventFee: 0, shirtPrice: 0 });
const saveSettings = (settings) => localStorage.setItem(settingsKey, JSON.stringify(settings));
const getPartyItems = () => readJson(partyKey, []);
const savePartyItems = (items) => localStorage.setItem(partyKey, JSON.stringify(items));
const getMembers = () => readJson(directoryKey, []);
const saveMembers = (items) => localStorage.setItem(directoryKey, JSON.stringify(items));

const calculateTotal = (item) => {
  const settings = getSettings();
  const paidShirts = Math.max(Number(item.shirtCount || 0) - 1, 0);
  const eventFee = item.eventFee !== undefined ? Number(item.eventFee || 0) : Number(settings.eventFee || 0);
  const shirtPrice = item.shirtPrice !== undefined ? Number(item.shirtPrice || 0) : Number(settings.shirtPrice || 0);
  return eventFee + paidShirts * shirtPrice;
};

const normalizePartyItems = () => getPartyItems().map((item, index) => ({
  ...item,
  id: item.id || "legacy-party-" + index + "-" + (item.registeredAt || index),
  paymentStatus: item.paymentStatus || (item.paymentProof ? "รอตรวจสอบ" : "ยังไม่ชำระ"),
  totalDue: calculateTotal(item)
}));

const normalizeMembers = () => getMembers().map((item, index) => ({
  ...item,
  id: item.id || "legacy-member-" + index + "-" + (item.createdAt || index)
}));

const renderPartyItems = () => {
  const items = normalizePartyItems();

  if (items.length === 0) {
    partyList.textContent = "ยังไม่มีข้อมูลผู้ร่วมงาน";
    return;
  }

  partyList.innerHTML = items.map((item) => `
    <article class="admin-registration-card">
      <div>
        <strong>${item.firstName} ${item.lastName}</strong>
        <span>${item.unit || "-"} • ${currency.format(item.totalDue || 0)} บาท • เสื้อ ${item.shirtCount || 0} ตัว</span>
      </div>
      <div class="admin-registration-actions">
        <select data-payment-status="${item.id}" aria-label="สถานะชำระเงินของ ${item.firstName} ${item.lastName}">
          <option value="ยังไม่ชำระ" ${item.paymentStatus === "ยังไม่ชำระ" ? "selected" : ""}>ยังไม่ชำระ</option>
          <option value="รอตรวจสอบ" ${item.paymentStatus === "รอตรวจสอบ" ? "selected" : ""}>รอตรวจสอบ</option>
          <option value="ชำระแล้ว" ${item.paymentStatus === "ชำระแล้ว" ? "selected" : ""}>ชำระแล้ว</option>
        </select>
        <button class="button button--ghost compact-action" type="button" data-edit-party="${item.id}">แก้ไข</button>
        <button class="admin-delete-button" type="button" data-delete-party="${item.id}">ลบผู้ร่วมงาน</button>
      </div>
    </article>
  `).join("");

  savePartyItems(items);
};

const renderMembers = () => {
  const members = normalizeMembers();

  if (members.length === 0) {
    directoryList.textContent = "ยังไม่มีข้อมูลสมาชิก";
    return;
  }

  directoryList.innerHTML = members.map((member) => `
    <article class="admin-registration-card">
      <div>
        <strong>${member.rank || ""} ${member.currentFirstName} ${member.currentLastName}</strong>
        <span>กองร้อยที่ ${member.company} • ${member.unit || "-"} • ${member.phone || "-"}</span>
      </div>
      <div class="admin-registration-actions">
        <button class="button button--ghost compact-action" type="button" data-edit-member="${member.id}">แก้ไข</button>
        <button class="admin-delete-button" type="button" data-delete-member="${member.id}">ลบสมาชิก</button>
      </div>
    </article>
  `).join("");

  saveMembers(members);
};

const unlockAdmin = () => {
  if (adminCodeInput.value !== adminPin) {
    adminStatus.textContent = "รหัสผ่าน Admin ไม่ถูกต้อง";
    adminStatus.classList.add("is-error");
    return;
  }

  const settings = getSettings();
  adminSettings.querySelector('[name="eventFee"]').value = settings.eventFee || 0;
  adminSettings.querySelector('[name="shirtPrice"]').value = settings.shirtPrice || 0;
  adminContent.hidden = false;
  adminStatus.textContent = "เข้าสู่ระบบ Admin แล้ว";
  adminStatus.classList.remove("is-error");
  renderPartyItems();
  renderMembers();
};

adminUnlock.addEventListener("click", unlockAdmin);
adminCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockAdmin();
});

adminSettings.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings({
    eventFee: Number(adminSettings.querySelector('[name="eventFee"]').value || 0),
    shirtPrice: Number(adminSettings.querySelector('[name="shirtPrice"]').value || 0)
  });
  adminStatus.textContent = "บันทึกค่าใช้จ่ายแล้ว";
  adminStatus.classList.remove("is-error");
  renderPartyItems();
});

partyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(partyForm);
  const settings = getSettings();
  const shirtSizes = String(formData.get("shirtSizes") || "").split(",").map((item) => item.trim()).filter(Boolean);
  const existing = normalizePartyItems();
  const current = existing.find((entry) => entry.id === editingPartyId);
  const item = {
    ...(current || {}),
    id: editingPartyId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    firstName: formData.get("firstName").trim(),
    lastName: formData.get("lastName").trim(),
    phone: formData.get("phone").trim(),
    unit: formData.get("unit").trim(),
    guestCount: formData.get("guestCount"),
    shirtCount: formData.get("shirtCount"),
    shirtSizes,
    eventFee: Number(settings.eventFee || 0),
    shirtPrice: Number(settings.shirtPrice || 0),
    paymentStatus: formData.get("paymentStatus"),
    paymentProof: current?.paymentProof || null,
    registeredAt: current?.registeredAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  item.totalDue = calculateTotal(item);

  const wasEditing = Boolean(editingPartyId);
  const items = wasEditing
    ? existing.map((entry) => entry.id === editingPartyId ? item : entry)
    : [item, ...existing];
  savePartyItems(items);
  partyForm.reset();
  editingPartyId = "";
  partySubmit.textContent = "เพิ่มผู้ร่วมงาน";
  renderPartyItems();
  adminStatus.textContent = wasEditing ? "แก้ไขผู้ร่วมงานแล้ว" : "บันทึกข้อมูลผู้ร่วมงานแล้ว";
  adminStatus.classList.remove("is-error");
});

partyList.addEventListener("change", (event) => {
  const id = event.target.dataset.paymentStatus;
  if (!id) return;
  const items = normalizePartyItems().map((item) => item.id === id ? { ...item, paymentStatus: event.target.value } : item);
  savePartyItems(items);
  renderPartyItems();
});

partyList.addEventListener("click", (event) => {
  const editId = event.target.dataset.editParty;
  const deleteId = event.target.dataset.deleteParty;
  const items = normalizePartyItems();

  if (editId) {
    const item = items.find((entry) => entry.id === editId);
    if (!item) return;
    editingPartyId = editId;
    partyForm.elements.firstName.value = item.firstName || "";
    partyForm.elements.lastName.value = item.lastName || "";
    partyForm.elements.phone.value = item.phone || "";
    partyForm.elements.unit.value = item.unit || "";
    partyForm.elements.guestCount.value = item.guestCount || 1;
    partyForm.elements.shirtCount.value = item.shirtCount || 0;
    partyForm.elements.shirtSizes.value = Array.isArray(item.shirtSizes) ? item.shirtSizes.join(", ") : "";
    partyForm.elements.paymentStatus.value = item.paymentStatus || "ยังไม่ชำระ";
    partySubmit.textContent = "บันทึกการแก้ไขผู้ร่วมงาน";
    adminStatus.textContent = "กำลังแก้ไขผู้ร่วมงาน " + (item.firstName || "") + " " + (item.lastName || "");
    adminStatus.classList.remove("is-error");
    partyForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!deleteId) return;
  const selected = items.find((item) => item.id === deleteId);
  const displayName = selected ? selected.firstName + " " + selected.lastName : "รายการนี้";
  if (!confirm("ยืนยันลบผู้ร่วมงาน " + displayName + "?")) return;
  savePartyItems(items.filter((item) => item.id !== deleteId));
  renderPartyItems();
  adminStatus.textContent = "ลบผู้ร่วมงาน " + displayName + " แล้ว";
  adminStatus.classList.remove("is-error");
});

directoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(directoryForm);
  const existing = normalizeMembers();
  const current = existing.find((entry) => entry.id === editingMemberId);
  const member = {
    ...(current || {}),
    id: editingMemberId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    rank: formData.get("rank").trim(),
    currentFirstName: formData.get("currentFirstName").trim(),
    oldFirstName: formData.get("oldFirstName").trim(),
    currentLastName: formData.get("currentLastName").trim(),
    oldLastName: formData.get("oldLastName").trim(),
    unit: formData.get("unit").trim(),
    phone: formData.get("phone").trim(),
    company: formData.get("company"),
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const wasEditing = Boolean(editingMemberId);
  const members = wasEditing
    ? existing.map((entry) => entry.id === editingMemberId ? member : entry)
    : [member, ...existing];
  saveMembers(members);
  directoryForm.reset();
  editingMemberId = "";
  directorySubmit.textContent = "เพิ่มสมาชิกทำเนียบ";
  renderMembers();
  adminStatus.textContent = wasEditing ? "แก้ไขสมาชิกทำเนียบแล้ว" : "บันทึกข้อมูลสมาชิกทำเนียบแล้ว";
  adminStatus.classList.remove("is-error");
});

directoryList.addEventListener("click", (event) => {
  const editId = event.target.dataset.editMember;
  const deleteId = event.target.dataset.deleteMember;
  const members = normalizeMembers();

  if (editId) {
    const member = members.find((entry) => entry.id === editId);
    if (!member) return;
    editingMemberId = editId;
    directoryForm.elements.rank.value = member.rank || "";
    directoryForm.elements.currentFirstName.value = member.currentFirstName || "";
    directoryForm.elements.oldFirstName.value = member.oldFirstName || "";
    directoryForm.elements.currentLastName.value = member.currentLastName || "";
    directoryForm.elements.oldLastName.value = member.oldLastName || "";
    directoryForm.elements.unit.value = member.unit || "";
    directoryForm.elements.phone.value = member.phone || "";
    directoryForm.elements.company.value = member.company || "1";
    directorySubmit.textContent = "บันทึกการแก้ไขสมาชิก";
    adminStatus.textContent = "กำลังแก้ไขสมาชิก " + (member.currentFirstName || "") + " " + (member.currentLastName || "");
    adminStatus.classList.remove("is-error");
    directoryForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!deleteId) return;
  const selected = members.find((member) => member.id === deleteId);
  const displayName = selected ? selected.currentFirstName + " " + selected.currentLastName : "สมาชิกนี้";
  if (!confirm("ยืนยันลบสมาชิก " + displayName + "?")) return;
  saveMembers(members.filter((member) => member.id !== deleteId));
  renderMembers();
  adminStatus.textContent = "ลบสมาชิก " + displayName + " แล้ว";
  adminStatus.classList.remove("is-error");
});
