const API_BASE = window.location.origin;
const SELECTED_DEVICE_KEY = "netscope-selected-device";
const SAMPLE_INTERVAL = 1000;
const WINDOW = 30000;

let devices = [];
let selectedComputer = localStorage.getItem(SELECTED_DEVICE_KEY) || "";
let samples = [];

const deviceList = document.getElementById("device-list");
const chartCanvas = document.getElementById("resourceChart");
const chartDeviceSelect = document.getElementById("chart-device-select");
const selectedDeviceLabel = document.getElementById("selected-device-label");

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function normalizeDevice(device) {
    return {
        name: String(device.computer || "Unknown device"),
        ip: String(device.ip || ""),
        windows: String(device.windows || ""),
        cpu: Number(device.cpu_usage) || 0,
        ram: Number(device.ram_usage) || 0,
        ramUsed: Number(device.ram_used_gb) || 0,
        ramTotal: Number(device.ram_total_gb) || 0,
        online: Boolean(device.online),
        lastSeen: Number(device.last_seen) || 0
    };
}

function clamp(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function resourceClass(value) {
    if (value >= 80) return "high";
    if (value >= 60) return "medium";
    return "low";
}

function resourceBar(label, value, online) {
    const safeValue = online ? clamp(value) : 0;
    return `<div class="resource" data-resource="${label.toLowerCase()}">
        <div class="resource-info"><span>${label}</span><span class="resource-value">${safeValue.toFixed(1)}%</span></div>
        <div class="progress"><div class="progress-fill ${resourceClass(safeValue)}" style="width:${safeValue}%"></div></div>
    </div>`;
}

function renderDevices() {
    if (!deviceList) return;
    deviceList.innerHTML = devices.length ? devices.map(device => `
        <article class="device expandable-device ${device.name === selectedComputer ? "selected" : ""}" data-computer="${escapeHTML(device.name)}">
            <div class="device-heading"><h3>${escapeHTML(device.name)}</h3>
                <span class="device-status ${device.online ? "online" : "offline"}"><span class="status-dot ${device.online ? "online" : "offline"}"></span>${device.online ? "Online" : "Offline"}</span>
            </div>
            <p class="device-ip">IP: ${escapeHTML(device.ip || "не определён")}</p>
            ${resourceBar("CPU", device.cpu, device.online)}
            ${resourceBar("RAM", device.ram, device.online)}
            <div class="device-expand"><span>${device.name === selectedComputer ? "Выбрано для графика" : "Показать на графике"}</span><span class="expand-arrow">⌄</span></div>
            <div class="device-details"><div class="details-divider"></div><h4>Информация об устройстве</h4>
                <div class="details-grid">
                    <div class="detail-item"><span>Имя устройства</span><strong>${escapeHTML(device.name)}</strong></div>
                    <div class="detail-item"><span>IP Address</span><strong>${escapeHTML(device.ip || "не определён")}</strong></div>
                    <div class="detail-item"><span>CPU Usage</span><strong>${device.online ? clamp(device.cpu).toFixed(1) : "0.0"}%</strong></div>
                    <div class="detail-item"><span>RAM Usage</span><strong>${device.online ? clamp(device.ram).toFixed(1) : "0.0"}%</strong></div>
                    <div class="detail-item"><span>Windows</span><strong>${escapeHTML(device.windows)}</strong></div>
                    <div class="detail-item"><span>Connection</span><strong>${device.online ? "Connected" : "Disconnected"}</strong></div>
                </div>
            </div>
        </article>`).join("") : `<p class="empty-message">Нет подключённых устройств. Запустите NetScope backend.</p>`;
}

function renderStats() {
    const online = devices.filter(device => device.online);
    document.getElementById("total-devices").textContent = devices.length;
    document.getElementById("online-devices").textContent = online.length;
    const average = online.length ? online.reduce((sum, device) => sum + device.cpu, 0) / online.length : 0;
    document.getElementById("average-cpu").textContent = `${average.toFixed(1)}%`;
}

function renderSelect() {
    if (!chartDeviceSelect) return;
    chartDeviceSelect.innerHTML = devices.map(device => `<option value="${escapeHTML(device.name)}">${escapeHTML(device.name)}</option>`).join("");
    if (!devices.some(device => device.name === selectedComputer)) selectedComputer = devices[0]?.name || "";
    chartDeviceSelect.value = selectedComputer;
    localStorage.setItem(SELECTED_DEVICE_KEY, selectedComputer);
    if (selectedDeviceLabel) selectedDeviceLabel.textContent = selectedComputer ? `Выбрано устройство: ${selectedComputer}` : "Нет подключённых устройств";
}

async function fetchDevices() {
    try {
        const response = await fetch(`${API_BASE}/api/devices`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        devices = (await response.json()).map(normalizeDevice);
        renderStats();
        renderSelect();
        renderDevices();
        await fetchHistory();
        document.querySelector(".connection span:last-child").textContent = "Backend connected";
        document.querySelector(".connection .status-dot").className = "status-dot online";
    } catch (error) {
        document.querySelector(".connection span:last-child").textContent = "Backend unavailable";
        document.querySelector(".connection .status-dot").className = "status-dot offline";
        console.error("Не удалось получить устройства:", error);
    }
}

async function fetchHistory() {
    if (!selectedComputer) { samples = []; return; }
    try {
        const response = await fetch(`${API_BASE}/api/device/history?computer=${encodeURIComponent(selectedComputer)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        samples = (await response.json()).map(sample => ({ t: sample.timestamp * 1000, cpu: clamp(sample.cpu), ram: clamp(sample.ram) }));
    } catch (error) {
        console.error("Не удалось получить историю:", error);
    }
}

if (deviceList) {
    deviceList.addEventListener("click", event => {
        const card = event.target.closest("[data-computer]");
        if (!card) return;
        selectedComputer = card.dataset.computer;
        localStorage.setItem(SELECTED_DEVICE_KEY, selectedComputer);
        renderSelect();
        renderDevices();
        fetchHistory();
    });
}

chartDeviceSelect?.addEventListener("change", () => {
    selectedComputer = chartDeviceSelect.value;
    localStorage.setItem(SELECTED_DEVICE_KEY, selectedComputer);
    renderSelect();
    renderDevices();
    fetchHistory();
});

function drawChart() {
    if (!chartCanvas?.getContext) return;
    const ctx = chartCanvas.getContext("2d");
    const box = chartCanvas.parentElement;
    const width = box.clientWidth;
    const height = box.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    chartCanvas.width = width * dpr;
    chartCanvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!width || !height) return;

    const style = getComputedStyle(document.documentElement);
    const color = name => style.getPropertyValue(name).trim();
    const pad = { left: 44, right: 14, top: 34, bottom: 28 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const now = Date.now();
    const start = now - WINDOW;
    const visible = samples.filter(sample => sample.t >= start);
    const xOf = time => pad.left + ((time - start) / WINDOW) * plotW;
    const yOf = value => pad.top + plotH - (value / 100) * plotH;
    ctx.font = `12px "IBM Plex Sans", sans-serif`;
    ctx.textAlign = "right";
    [0, 25, 50, 75, 100].forEach(step => {
        const y = yOf(step);
        ctx.strokeStyle = color("--line"); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
        ctx.fillStyle = color("--muted"); ctx.fillText(`${step}%`, pad.left - 10, y);
    });
    ctx.textAlign = "left"; ctx.fillStyle = color("--muted"); ctx.fillText("30 сек. назад", pad.left, height - 6);
    ctx.textAlign = "right"; ctx.fillText("Сейчас", width - pad.right, height - 6);
    if (visible.length < 2) return;

    const line = (key, stroke, dashed) => {
        ctx.beginPath(); visible.forEach((sample, index) => index ? ctx.lineTo(xOf(sample.t), yOf(sample[key])) : ctx.moveTo(xOf(sample.t), yOf(sample[key])));
        ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.setLineDash(dashed ? [6, 5] : []); ctx.stroke(); ctx.setLineDash([]);
    };
    line("ram", color("--text"), true); line("cpu", color("--accent"), false);
    const latest = visible[visible.length - 1];
    ctx.textAlign = "left"; ctx.fillStyle = color("--text"); ctx.fillText(`CPU ${latest.cpu.toFixed(0)}%`, pad.left, 14);
    ctx.fillText(`RAM ${latest.ram.toFixed(0)}%`, pad.left + 90, 14);
}

window.addEventListener("resize", drawChart);
setInterval(() => { fetchDevices(); }, 1000);
setInterval(drawChart, 1000);
fetchDevices();
drawChart();
