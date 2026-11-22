let devices = [];
const table = document.getElementById("devices-table");
const searchInput = document.getElementById("device-search");
const statusFilter = document.getElementById("status-filter");
const sortFilter = document.getElementById("sort-filter");
const resetButton = document.getElementById("reset-filters");
const deviceCount = document.getElementById("device-count");

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function renderDevices() {
    const search = searchInput.value.trim().toLowerCase();
    let filtered = devices.filter(device => {
        const matchesSearch = device.computer.toLowerCase().includes(search) || String(device.ip || "").toLowerCase().includes(search);
        const matchesStatus = statusFilter.value === "all" || (statusFilter.value === "online" ? device.online : !device.online);
        return matchesSearch && matchesStatus;
    });
    filtered.sort((a, b) => {
        if (sortFilter.value === "name-desc") return b.computer.localeCompare(a.computer);
        if (sortFilter.value === "cpu-desc") return (b.online ? b.cpu_usage : 0) - (a.online ? a.cpu_usage : 0);
        if (sortFilter.value === "cpu-asc") return (a.online ? a.cpu_usage : 0) - (b.online ? b.cpu_usage : 0);
        return a.computer.localeCompare(b.computer);
    });
    deviceCount.textContent = filtered.length;
    table.innerHTML = filtered.length ? filtered.map(device => `
        <tr><td><strong>${escapeHTML(device.computer)}</strong></td>
        <td>${escapeHTML(device.ip || "не определён")}</td>
        <td>${device.online ? Number(device.cpu_usage || 0).toFixed(1) : "0.0"}%</td>
        <td>${device.online ? Number(device.ram_usage || 0).toFixed(1) : "0.0"}%</td>
        <td><span class="device-status ${device.online ? "online" : "offline"}"><span class="status-dot ${device.online ? "online" : "offline"}"></span>${device.online ? "Online" : "Offline"}</span></td></tr>`).join("") : `<tr><td colspan="5" class="empty-message">Устройства не найдены</td></tr>`;
}

async function fetchDevices() {
    try {
        const response = await fetch(`${window.location.origin}/api/devices`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        devices = await response.json();
        renderDevices();
    } catch (error) {
        devices = [];
        renderDevices();
        console.error("Не удалось получить устройства:", error);
    }
}

searchInput.addEventListener("input", renderDevices);
statusFilter.addEventListener("change", renderDevices);
sortFilter.addEventListener("change", renderDevices);
resetButton.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "all";
    sortFilter.value = "name-asc";
    renderDevices();
});

fetchDevices();
setInterval(fetchDevices, 3000);
