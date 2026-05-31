const registrationList = document.querySelector("#registration-list");
const registrationSummary = document.querySelector("#registration-summary");
const storageKey = "cavalry3040PartyRegistrations";
const roomsKey = "cavalry3040PartyRooms";

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));

const registrations = JSON.parse(localStorage.getItem(storageKey) || "[]");
const rooms = JSON.parse(localStorage.getItem(roomsKey) || "[]");

const getRoomNumber = (roomId) => {
  const room = rooms.find((item) => item.id === roomId);
  return room ? room.roomNumber : "-";
};

const getDisplayName = (item, index) => {
  const displayName = [item.rank, item.firstName, item.lastName].filter(Boolean).join(" ").trim();
  return displayName || "ผู้เข้าร่วมงาน " + (index + 1);
};

const getGuestCount = (value) => {
  const normalized = String(value || "").replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit)).replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
};

const totalGuests = registrations.reduce((sum, item) => sum + getGuestCount(item.guestCount), 0);

if (registrationSummary) {
  registrationSummary.textContent = "สรุปผู้เข้าร่วมงานทั้งหมด: " + totalGuests.toLocaleString("th-TH") + " คน";
}

if (registrations.length > 0) {
  registrationList.innerHTML = registrations.map((item, index) => `
    <tr>
      <td>${escapeHtml(getDisplayName(item, index))}</td>
      <td>${escapeHtml(item.guestCount || 0)} คน</td>
      <td>${escapeHtml(getRoomNumber(item.roomId))}</td>
    </tr>
  `).join("");
}
