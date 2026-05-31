const directoryForm = document.querySelector("#directory-form");
const directoryStatus = document.querySelector("#directory-status");
const directoryTables = document.querySelector("#directory-tables");
const filterButtons = document.querySelectorAll("[data-company-filter]");
const submitButton = document.querySelector("#directory-submit-button");
const adminCodeInput = document.querySelector("#directory-admin-code");
const adminUnlock = document.querySelector("#directory-admin-unlock");
const adminStatus = document.querySelector("#directory-admin-status");
const directoryKey = "cavalry3040DirectoryMembers";
const adminPin = "cavalry3040";

const companies = ["1", "2", "3"];
let activeCompany = "all";
let adminUnlocked = false;
let editingMemberId = "";

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));

const getMembers = () => JSON.parse(localStorage.getItem(directoryKey) || "[]").map((item, index) => ({
  ...item,
  id: item.id || "legacy-member-" + index + "-" + (item.createdAt || index)
}));
const saveMembers = (members) => localStorage.setItem(directoryKey, JSON.stringify(members));
const normalizeName = (firstName, lastName) => String((firstName || "") + " " + (lastName || "")).replace(/\s+/g, " ").trim().toLocaleLowerCase("th-TH");
const hasDuplicateName = (members, firstName, lastName, currentId = "") => {
  const targetName = normalizeName(firstName, lastName);
  return members.some((member) => member.id !== currentId && normalizeName(member.currentFirstName, member.currentLastName) === targetName);
};

const resetEditMode = () => {
  editingMemberId = "";
  submitButton.textContent = "บันทึกข้อมูลทำเนียบ";
};

const renderCompanyTable = (company, members) => {
  const rows = members.filter((member) => member.company === company);
  const actionHeader = adminUnlocked ? "<th>จัดการ</th>" : "";
  const colspan = adminUnlocked ? 9 : 8;
  const emptyRow = `
    <tr>
      <td colspan="${colspan}">ยังไม่มีข้อมูลกองร้อยที่ ${company}</td>
    </tr>
  `;

  return `
    <section class="company-directory" data-company-section="${company}">
      <div class="company-directory__heading">
        <h3>กองร้อยที่ ${company}</h3>
        <span>${rows.length} รายชื่อ</span>
      </div>
      <div class="registration-table-wrap directory-table-wrap">
        <table class="registration-table directory-table">
          <thead>
            <tr>
              <th>ยศ</th>
              <th>ชื่อปัจจุบัน</th>
              <th>ชื่อเดิม</th>
              <th>นามสกุลปัจจุบัน</th>
              <th>นามสกุลเดิม</th>
              <th>สังกัด</th>
              <th>เบอร์โทร</th>
              <th>กองร้อย</th>
              ${actionHeader}
            </tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows.map((member) => `
              <tr>
                <td>${escapeHtml(member.rank)}</td>
                <td>${escapeHtml(member.currentFirstName)}</td>
                <td>${escapeHtml(member.oldFirstName) || "-"}</td>
                <td>${escapeHtml(member.currentLastName)}</td>
                <td>${escapeHtml(member.oldLastName) || "-"}</td>
                <td>${escapeHtml(member.unit)}</td>
                <td>${escapeHtml(member.phone)}</td>
                <td>${escapeHtml(member.company)}</td>
                ${adminUnlocked ? `<td><span class="inline-actions"><button class="button button--ghost compact-action" type="button" data-edit-member="${member.id}">แก้ไข</button><button class="admin-delete-button" type="button" data-delete-member="${member.id}">ลบ</button></span></td>` : ""}
              </tr>
            `).join("") : emptyRow}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const renderDirectory = () => {
  const members = getMembers();
  saveMembers(members);
  directoryTables.innerHTML = companies.map((company) => renderCompanyTable(company, members)).join("");

  document.querySelectorAll("[data-company-section]").forEach((section) => {
    section.hidden = activeCompany !== "all" && section.dataset.companySection !== activeCompany;
  });
};

directoryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(directoryForm);
  const members = getMembers();
  const currentFirstName = String(formData.get("currentFirstName") || "").trim();
  const currentLastName = String(formData.get("currentLastName") || "").trim();

  if (hasDuplicateName(members, currentFirstName, currentLastName, editingMemberId)) {
    directoryStatus.textContent = "มีชื่อและนามสกุลนี้ในทำเนียบรุ่นแล้ว กรุณาตรวจสอบข้อมูลอีกครั้ง";
    directoryStatus.classList.add("is-error");
    return;
  }

  const member = {
    id: editingMemberId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    rank: formData.get("rank").trim(),
    currentFirstName,
    oldFirstName: formData.get("oldFirstName").trim(),
    currentLastName,
    oldLastName: formData.get("oldLastName").trim(),
    unit: formData.get("unit").trim(),
    phone: formData.get("phone").trim(),
    company: formData.get("company"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const next = editingMemberId
    ? members.map((item) => item.id === editingMemberId ? { ...item, ...member, createdAt: item.createdAt || member.createdAt } : item)
    : [member, ...members];
  saveMembers(next);

  directoryStatus.textContent = editingMemberId ? "แก้ไขข้อมูลทำเนียบเรียบร้อยแล้ว" : "บันทึกข้อมูลทำเนียบเรียบร้อยแล้ว";
  directoryStatus.classList.remove("is-error");
  directoryForm.reset();
  resetEditMode();
  renderDirectory();
});

adminUnlock.addEventListener("click", () => {
  if (adminCodeInput.value !== adminPin) {
    adminStatus.textContent = "รหัสผ่าน Admin ไม่ถูกต้อง";
    adminStatus.classList.add("is-error");
    return;
  }
  adminUnlocked = true;
  adminStatus.textContent = "ปลดล็อกการจัดการทำเนียบแล้ว";
  adminStatus.classList.remove("is-error");
  renderDirectory();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCompany = button.dataset.companyFilter;
    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderDirectory();
  });
});

directoryTables.addEventListener("click", (event) => {
  const editId = event.target.dataset.editMember;
  const deleteId = event.target.dataset.deleteMember;
  const members = getMembers();

  if (editId) {
    const member = members.find((item) => item.id === editId);
    if (!member) return;
    editingMemberId = editId;
    directoryForm.elements.rank.value = member.rank || "";
    directoryForm.elements.currentFirstName.value = member.currentFirstName || "";
    directoryForm.elements.oldFirstName.value = member.oldFirstName || "";
    directoryForm.elements.currentLastName.value = member.currentLastName || "";
    directoryForm.elements.oldLastName.value = member.oldLastName || "";
    directoryForm.elements.unit.value = member.unit || "";
    directoryForm.elements.phone.value = member.phone || "";
    directoryForm.elements.company.value = member.company || "";
    submitButton.textContent = "บันทึกการแก้ไข";
    directoryStatus.textContent = "กำลังแก้ไขข้อมูลของ " + (member.currentFirstName || "") + " " + (member.currentLastName || "");
    directoryStatus.classList.remove("is-error");
    directoryForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (deleteId) {
    const member = members.find((item) => item.id === deleteId);
    const displayName = member ? member.currentFirstName + " " + member.currentLastName : "สมาชิกนี้";
    if (!confirm("ยืนยันลบสมาชิก " + displayName + "?")) return;
    saveMembers(members.filter((item) => item.id !== deleteId));
    renderDirectory();
    adminStatus.textContent = "ลบสมาชิก " + displayName + " แล้ว";
    adminStatus.classList.remove("is-error");
  }
});

renderDirectory();
