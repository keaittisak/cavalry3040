const registrationList = document.querySelector("#registration-list");
const registrationSummary = document.querySelector("#registration-summary");
const storageKey = "cavalry3040PartyRegistrations";
const roomsKey = "cavalry3040PartyRooms";
let siteData = { rooms: [], registrations: [] };

const escapeHtml = (value) => String(value || "").replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;"
}[character]));

const readLocalJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("Invalid localStorage data", key, error);
    return fallback;
  }
};

const loadSiteData = async () => {
  try {
    const response = await fetch("site-data.json", { cache: "no-store" });
    if (!response.ok) return;
    siteData = { ...siteData, ...(await response.json()) };
  } catch (error) {
    console.warn("Cannot load site-data.json", error);
  }
};

const getGuestCount = (value) => {
  const normalized = String(value || "").replace(/[๐-๙]/g, (digit) => "๐๑๒๓๔๕๖๗๘๙".indexOf(digit)).replace(/[^0-9.]/g, "");
  return Number(normalized) || 0;
};

const getRoomBookings = (item) => {
  if (Array.isArray(item?.roomBookings)) return item.roomBookings.filter((booking) => booking?.roomId);
  if (item?.roomId) return [{ roomId: item.roomId, guests: item.roomGuestCount || item.guestCount }];
  return [];
};

const getDisplayName = (item, index) => {
  const displayName = [item.rank, item.firstName, item.lastName].filter(Boolean).join(" ").trim();
  return displayName || "ผู้เข้าร่วมงาน " + (index + 1);
};

const renderIndex = async () => {
  await loadSiteData();
  const registrations = readLocalJson(storageKey, siteData.registrations || []);
  const rooms = readLocalJson(roomsKey, siteData.rooms || []);
  const getRoomNumber = (item) => {
    const text = getRoomBookings(item).map((booking) => {
      const room = rooms.find((entry) => entry.id === booking.roomId);
      return room ? room.roomNumber : "-";
    }).join(", ");
    const pending = getGuestCount(item.pendingRoomGuests);
    return [text || "-", pending ? "ค้างจัด " + pending + " คน" : ""].filter(Boolean).join(" • ");
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
        <td>${escapeHtml(getRoomNumber(item))}</td>
      </tr>
    `).join("");
  }
};
renderIndex();
