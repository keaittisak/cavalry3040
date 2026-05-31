const committeeList = document.querySelector("#committee-list");
const adminCodeInput = document.querySelector("#committee-admin-code");
const adminUnlock = document.querySelector("#committee-admin-unlock");
const adminStatus = document.querySelector("#committee-admin-status");
const committeeForm = document.querySelector("#committee-form");
const committeeStatus = document.querySelector("#committee-status");
const submitButton = document.querySelector("#committee-submit-button");
const cancelButton = document.querySelector("#committee-cancel-button");

const committeeKey = "cavalry3040CommitteeMembers";
const adminPin = "cavalry3040";
const roleOrder = ["ประธาน", "รองประธาน", "เลขา", "กรรมการ"];
let adminUnlocked = false;
let editingCommitteeId = "";

const createCommitteeId = () => globalThis.crypto?.randomUUID?.() || "committee-" + Date.now();

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
};

const getCommittee = () => readJson(committeeKey, []).map((item, index) => ({
  ...item,
  id: item.id || "legacy-committee-" + index + "-" + (item.createdAt || index)
}));

const saveCommittee = (items) => localStorage.setItem(committeeKey, JSON.stringify(items));

const sortCommittee = (items) => [...items].sort((a, b) => {
  const roleA = roleOrder.indexOf(a.role);
  const roleB = roleOrder.indexOf(b.role);
  const normalizedA = roleA === -1 ? roleOrder.length : roleA;
  const normalizedB = roleB === -1 ? roleOrder.length : roleB;
  if (normalizedA !== normalizedB) return normalizedA - normalizedB;
  return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
});

const resetForm = () => {
  editingCommitteeId = "";
  committeeForm.reset();
  submitButton.textContent = "เพิ่มคณะกรรมการ";
};

const renderCommittee = () => {
  const items = sortCommittee(getCommittee());
  saveCommittee(items);

  if (items.length === 0) {
    committeeList.textContent = "ยังไม่มีข้อมูลคณะกรรมการ";
    return;
  }

  committeeList.innerHTML = roleOrder.map((role) => {
    const rows = items.filter((item) => item.role === role);
    if (rows.length === 0) return "";

    return `
      <section class="company-directory committee-role-group">
        <div class="company-directory__heading">
          <h3>${role}</h3>
          <span>${rows.length} รายชื่อ</span>
        </div>
        <div class="committee-card-grid">
          ${rows.map((item) => `
            <article class="committee-member-card">
              <div>
                <strong>${escapeHtml(item.rank)} ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</strong>
                <span>${escapeHtml(item.role)}</span>
              </div>
              ${adminUnlocked ? `
                <div class="admin-registration-actions">
                  <button class="button button--ghost compact-action" type="button" data-edit-committee="${item.id}">แก้ไข</button>
                  <button class="admin-delete-button" type="button" data-delete-committee="${item.id}">ลบ</button>
                </div>
              ` : ""}
            </article>
          `).join("")}
        </div>
      </section>
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
  committeeForm.hidden = false;
  adminStatus.textContent = "ปลดล็อกการจัดการคณะกรรมการแล้ว";
  adminStatus.classList.remove("is-error");
  renderCommittee();
});

committeeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(committeeForm);
  const existing = getCommittee();
  const current = existing.find((item) => item.id === editingCommitteeId);
  const member = {
    ...(current || {}),
    id: editingCommitteeId || createCommitteeId(),
    rank: String(formData.get("rank") || "").trim(),
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    role: formData.get("role"),
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const wasEditing = Boolean(editingCommitteeId);
  const next = wasEditing
    ? existing.map((item) => item.id === editingCommitteeId ? member : item)
    : [member, ...existing];

  saveCommittee(sortCommittee(next));
  resetForm();
  committeeStatus.textContent = wasEditing ? "แก้ไขรายชื่อคณะกรรมการแล้ว" : "เพิ่มรายชื่อคณะกรรมการแล้ว";
  committeeStatus.classList.remove("is-error");
  renderCommittee();
});

cancelButton.addEventListener("click", () => {
  resetForm();
  committeeStatus.textContent = "ยกเลิกการแก้ไขแล้ว";
  committeeStatus.classList.remove("is-error");
});

committeeList.addEventListener("click", (event) => {
  const editId = event.target.dataset.editCommittee;
  const deleteId = event.target.dataset.deleteCommittee;
  const items = getCommittee();

  if (editId) {
    const member = items.find((item) => item.id === editId);
    if (!member) return;
    editingCommitteeId = editId;
    committeeForm.hidden = false;
    committeeForm.elements.rank.value = member.rank || "";
    committeeForm.elements.firstName.value = member.firstName || "";
    committeeForm.elements.lastName.value = member.lastName || "";
    committeeForm.elements.role.value = member.role || "กรรมการ";
    submitButton.textContent = "บันทึกการแก้ไขคณะกรรมการ";
    committeeStatus.textContent = "กำลังแก้ไข " + (member.firstName || "") + " " + (member.lastName || "");
    committeeStatus.classList.remove("is-error");
    committeeForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!deleteId) return;
  const member = items.find((item) => item.id === deleteId);
  const displayName = member ? member.firstName + " " + member.lastName : "รายการนี้";
  if (!confirm("ยืนยันลบคณะกรรมการ " + displayName + "?")) return;
  saveCommittee(items.filter((item) => item.id !== deleteId));
  committeeStatus.textContent = "ลบรายชื่อ " + displayName + " แล้ว";
  committeeStatus.classList.remove("is-error");
  renderCommittee();
});

renderCommittee();
