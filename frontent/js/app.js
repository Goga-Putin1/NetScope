// ==========================================
// NetScope — Dashboard
// ==========================================

const STORAGE_KEY = "netscope-devices";
const SERVER_URL_KEY = "netscope-server-url";

function normalizeDevice(device) {
    if (!device || typeof device !== "object") return null;

    return {
        name: String(device.name || "Unknown device"),
        ip: String(device.ip || ""),
        cpu: Number(device.cpu) || 0,
        ram: Number(device.ram) || 0,
        online: Boolean(device.online)
    };
}

const DEFAULT_DEVICES = [
    { name: "Main-PC", ip: "192.168.1.10", cpu: 24, ram: 58, online: true },
    { name: "Gaming-PC", ip: "192.168.1.11", cpu: 67, ram: 72, online: true },
    { name: "Office-PC", ip: "192.168.1.12", cpu: 0, ram: 0, online: false }
];

function loadDevices() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return Array.isArray(parsed)
            ? parsed.map(normalizeDevice).filter(Boolean)
            : DEFAULT_DEVICES.map(normalizeDevice);
    } catch (error) {
        console.error("Не удалось загрузить устройства:", error);
        return DEFAULT_DEVICES.map(normalizeDevice);
    }
}

const devices = loadDevices();

// Безопасное отображение пользовательского текста
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


// ==========================================
// Отображение устройств
// ==========================================

const deviceList = document.getElementById("device-list");

function getResourceClass(value) {
    if (value >= 80) return "high";
    if (value >= 60) return "medium";
    return "low";
}

function createResourceBar(label, value, online) {
    const numericValue = Math.max(0, Math.min(100, Number(value) || 0));
    const displayedValue = online ? numericValue : 0;
    const resource = label.toLowerCase();

    return `
        <div class="resource" data-resource="${resource}">
            <div class="resource-info">
                <span>${label}</span>
                <span class="resource-value">${displayedValue}%</span>
            </div>

            <div class="progress">
                <div
                    class="progress-fill ${getResourceClass(displayedValue)}"
                    style="width: ${displayedValue}%"
                ></div>
            </div>
        </div>
    `;
}


if (deviceList) {
    deviceList.innerHTML = devices.map((device, index) => `
        <article
            class="device expandable-device"
            data-device-index="${index}"
        >
            <div class="device-heading">
                <h3 data-device-name>${escapeHTML(device.name)}</h3>

                <span class="device-status ${device.online ? "online" : "offline"}">
                    <span class="status-dot ${device.online ? "online" : "offline"}"></span>
                    ${device.online ? "Online" : "Offline"}
                </span>
            </div>

            <p class="device-ip">IP: ${escapeHTML(device.ip)}</p>

            ${createResourceBar("CPU", device.cpu, device.online)}
            ${createResourceBar("RAM", device.ram, device.online)}

            <div class="device-expand">
                <span class="expand-text">Подробнее</span>
                <span class="expand-arrow">⌄</span>
            </div>

            <div class="device-details">
                <div class="details-divider"></div>

                <h4>Информация об устройстве</h4>

                <div class="details-grid">
                    <div class="detail-item">
                        <span>Имя устройства</span>
                        <strong>${escapeHTML(device.name)}</strong>
                    </div>

                    <div class="detail-item">
                        <span>IP Address</span>
                        <strong>${escapeHTML(device.ip)}</strong>
                    </div>

                    <div class="detail-item">
                        <span>CPU Usage</span>
                        <strong data-detail-cpu>${device.online ? Number(device.cpu) || 0 : 0}%</strong>
                    </div>

                    <div class="detail-item">
                        <span>RAM Usage</span>
                        <strong data-detail-ram>${device.online ? Number(device.ram) || 0 : 0}%</strong>
                    </div>

                    <div class="detail-item">
                        <span>Connection</span>
                        <strong>${device.online ? "Connected" : "Disconnected"}</strong>
                    </div>

                    <div class="detail-item">
                        <span>Device ID</span>
                        <strong>NS-${String(index + 1).padStart(3, "0")}</strong>
                    </div>
                </div>

                ${!device.online ? `
                    <p class="offline-message">
                        Устройство сейчас недоступно
                    </p>
                ` : ""}
            </div>
        </article>
    `).join("");

    // Обработка нажатий на карточки
    deviceList.addEventListener("click", event => {
        const card = event.target.closest(".expandable-device");

        if (!card) return;

        card.classList.toggle("expanded");

        const isExpanded = card.classList.contains("expanded");

        card.querySelector(".expand-text").textContent =
            isExpanded ? "Свернуть" : "Подробнее";
    });
}


// ==========================================
// Dashboard Statistics
// ==========================================

function updateStatistics() {
    const totalDevices = devices.length;

    const onlineDevices = devices.filter(
        device => device.online
    );

    const averageCPU = onlineDevices.length
        ? onlineDevices.reduce(
            (total, device) => total + (Number(device.cpu) || 0), 0
        ) / onlineDevices.length
        : 0;

    document.getElementById("total-devices").textContent =
        totalDevices;

    document.getElementById("online-devices").textContent =
        onlineDevices.length;

    document.getElementById("average-cpu").textContent =
        `${averageCPU.toFixed(1)}%`;
}

updateStatistics();
// ==========================================
// Получение реальных метрик с Backend
// ==========================================

async function fetchRealMetrics() {
    try {
        const configuredServer = localStorage.getItem(SERVER_URL_KEY);
        const endpoint = `${(configuredServer || window.location.origin).replace(/\/$/, "")}/api/metrics`;
        const response = await fetch(endpoint, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const metrics = await response.json();
        const device = devices[0];
        if (!device) return;

        device.name = metrics.computer || device.name;
        device.cpu = Number(metrics.cpu_usage) || 0;
        device.ram = Number(metrics.ram_usage) || 0;
        device.online = true;

        const card = deviceList?.querySelector('[data-device-index="0"]');
        if (card) {
            const name = card.querySelector("[data-device-name]");
            if (name) name.textContent = device.name;

            const status = card.querySelector(".device-status");
            const dot = card.querySelector(".status-dot");
            if (status) {
                status.classList.remove("offline");
                status.classList.add("online");
                status.textContent = "Online";
            }
            if (dot) {
                dot.classList.remove("offline");
                dot.classList.add("online");
            }

            ["cpu", "ram"].forEach(resource => {
                const element = card.querySelector(`[data-resource="${resource}"]`);
                if (!element) return;

                const value = resource === "cpu" ? device.cpu : device.ram;
                const safeValue = Math.max(0, Math.min(100, value));
                const valueElement = element.querySelector(".resource-value");
                const fill = element.querySelector(".progress-fill");

                if (valueElement) valueElement.textContent = `${safeValue.toFixed(2)}%`;
                if (fill) {
                    fill.style.width = `${safeValue}%`;
                    fill.className = `progress-fill ${getResourceClass(safeValue)}`;
                }
            });

            const detailCPU = card.querySelector("[data-detail-cpu]");
            const detailRAM = card.querySelector("[data-detail-ram]");
            if (detailCPU) detailCPU.textContent = `${device.cpu.toFixed(2)}%`;
            if (detailRAM) detailRAM.textContent = `${device.ram.toFixed(2)}%`;
        }

        updateStatistics();
    } catch (error) {
        console.error("Не удалось получить метрики:", error);
    }
}

// Первый запрос и обновление каждую секунду
fetchRealMetrics();
setInterval(fetchRealMetrics, 1000);
// ==========================================
// График CPU и RAM (демо, значения случайные)
// Рисуется на canvas, внешние библиотеки не нужны
// ==========================================

const chartCanvas = document.getElementById("resourceChart");

if (chartCanvas && chartCanvas.getContext) {

    const ctx = chartCanvas.getContext("2d");

    // Настройки
    const SAMPLE_INTERVAL = 1000;   // новое значение каждую секунду
    const WINDOW = 30000;           // график показывает последние 30 секунд
    const DELAY = SAMPLE_INTERVAL;  // рисуем с небольшой задержкой для плавности
    const Y_STEPS = [0, 25, 50, 75, 100];

    const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    // Цвета берём из темы (style.css)
    const rootStyle = getComputedStyle(document.documentElement);
    const themeColor = (name, fallback) =>
        rootStyle.getPropertyValue(name).trim() || fallback;

    const COLOR_CPU = themeColor("--accent", "#8fb4ff");
    const COLOR_RAM = "#c9ccd3";
    const COLOR_GRID = themeColor("--line", "#23262b");
    const COLOR_BORDER = themeColor("--line-strong", "#323640");
    const COLOR_MUTED = themeColor("--muted", "#8c909a");
    const COLOR_TEXT = themeColor("--text", "#e9eaed");
    const COLOR_SURFACE = themeColor("--surface-2", "#181a1e");

    const FONT = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

    chartCanvas.setAttribute("role", "img");
    chartCanvas.setAttribute(
        "aria-label",
        "График загрузки CPU и RAM за последние 30 секунд"
    );

    // ======================================
    // Данные
    // ======================================

    let cpuValue = 35;
    let ramValue = 55;

    const samples = [];

    const clamp = (value, min, max) =>
        Math.max(min, Math.min(max, value));

    // Получение реальных показателей устройства
function pushSample(time) {

const mainDevice = devices[0];

cpuValue = clamp(Number(mainDevice?.cpu) || 0, 0, 100);
ramValue = clamp(Number(mainDevice?.ram) || 0, 0, 100);

samples.push({
    t: time,
    cpu: cpuValue,
    ram: ramValue
});
}

    // Начальная история
    const startTime = Date.now();

    for (let i = 40; i >= 0; i--) {
        pushSample(startTime - i * SAMPLE_INTERVAL);
    }

    // Значение между двумя соседними точками
    function valueAt(key, time) {

        for (let i = samples.length - 1; i > 0; i--) {

            const a = samples[i - 1];
            const b = samples[i];

            if (time >= a.t && time <= b.t) {
                const ratio = (time - a.t) / ((b.t - a.t) || 1);
                return a[key] + (b[key] - a[key]) * ratio;
            }

        }

        return samples[samples.length - 1][key];

    }


    // ======================================
    // Размер canvas
    // ======================================

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {

        const box = chartCanvas.parentElement;

        width = box.clientWidth;
        height = box.clientHeight;
        dpr = window.devicePixelRatio || 1;

        chartCanvas.width = Math.round(width * dpr);
        chartCanvas.height = Math.round(height * dpr);

        if (reduceMotion) draw();

    }

    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(resize).observe(chartCanvas.parentElement);
    } else {
        window.addEventListener("resize", resize);
    }


    // ======================================
    // Наведение мыши / касание
    // ======================================

    let hoverX = null;

    function setHover(event) {
        const rect = chartCanvas.getBoundingClientRect();
        hoverX = event.clientX - rect.left;
        if (reduceMotion) draw();
    }

    function clearHover() {
        hoverX = null;
        if (reduceMotion) draw();
    }

    chartCanvas.addEventListener("pointermove", setHover);
    chartCanvas.addEventListener("pointerdown", setHover);
    chartCanvas.addEventListener("pointerleave", clearHover);
    chartCanvas.addEventListener("pointercancel", clearHover);


    // ======================================
    // Отрисовка
    // ======================================

    // Плавная линия через набор точек
    function tracePath(points) {

        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i++) {

            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;

            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);

        }

        const last = points[points.length - 1];

        ctx.lineTo(last.x, last.y);

    }

    function roundedRect(x, y, w, h, r) {

        ctx.beginPath();

        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.rect(x, y, w, h);
        }

    }

    function draw() {

        if (!width || !height) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const pad = { left: 44, right: 14, top: 34, bottom: 28 };
        const plotW = width - pad.left - pad.right;
        const plotH = height - pad.top - pad.bottom;

        if (plotW <= 0 || plotH <= 0) return;

        // Время, которое сейчас в правом краю графика
        const renderTime = reduceMotion
            ? samples[samples.length - 1].t
            : Date.now() - DELAY;

        const windowStart = renderTime - WINDOW;

        // Удаляем старые точки
        while (samples.length > 3 && samples[1].t < windowStart - SAMPLE_INTERVAL) {
            samples.shift();
        }

        const xOf = time => pad.left + ((time - windowStart) / WINDOW) * plotW;
        const yOf = value => pad.top + plotH - (value / 100) * plotH;

        ctx.font = `12px ${FONT}`;

        // --- Сетка и подписи оси Y ---
        ctx.lineWidth = 1;
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";

        Y_STEPS.forEach(step => {

            const y = Math.round(yOf(step)) + 0.5;

            ctx.strokeStyle = COLOR_GRID;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + plotW, y);
            ctx.stroke();

            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(`${step}%`, pad.left - 10, y);

        });

        // --- Подписи оси X ---
        const xLabels = [
            { text: "30 сек. назад", ratio: 0, align: "left" },
            { text: "20 сек.", ratio: 1 / 3, align: "center" },
            { text: "10 сек.", ratio: 2 / 3, align: "center" },
            { text: "Сейчас", ratio: 1, align: "right" }
        ];

        ctx.textBaseline = "top";
        ctx.fillStyle = COLOR_MUTED;

        xLabels.forEach(label => {
            ctx.textAlign = label.align;
            ctx.fillText(label.text, pad.left + plotW * label.ratio, pad.top + plotH + 9);
        });

        // --- Линии ---
        const visible = samples.filter(
            sample => sample.t >= windowStart - 2 * SAMPLE_INTERVAL
        );

        if (visible.length > 2) {

            ctx.save();
            ctx.beginPath();
            ctx.rect(pad.left, pad.top - 4, plotW, plotH + 8);
            ctx.clip();

            const toPoints = key =>
                visible.map(sample => ({
                    x: xOf(sample.t),
                    y: yOf(sample[key])
                }));

            const cpuPoints = toPoints("cpu");
            const ramPoints = toPoints("ram");

            // Заливка под CPU
            const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
            gradient.addColorStop(0, "rgba(143, 180, 255, 0.20)");
            gradient.addColorStop(1, "rgba(143, 180, 255, 0)");

            ctx.beginPath();
            tracePath(cpuPoints);
            ctx.lineTo(cpuPoints[cpuPoints.length - 1].x, pad.top + plotH);
            ctx.lineTo(cpuPoints[0].x, pad.top + plotH);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.lineWidth = 2;

            // RAM — пунктир
            ctx.beginPath();
            tracePath(ramPoints);
            ctx.strokeStyle = COLOR_RAM;
            ctx.setLineDash([6, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // CPU — сплошная линия
            ctx.beginPath();
            tracePath(cpuPoints);
            ctx.strokeStyle = COLOR_CPU;
            ctx.stroke();

            ctx.restore();

        }

        // --- Легенда с текущими значениями ---
        const cpuNow = Math.round(valueAt("cpu", renderTime));
        const ramNow = Math.round(valueAt("ram", renderTime));

        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        let legendX = pad.left;

        [
            { name: "CPU", value: cpuNow, color: COLOR_CPU, dashed: false },
            { name: "RAM", value: ramNow, color: COLOR_RAM, dashed: true }
        ].forEach(item => {

            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2;
            ctx.setLineDash(item.dashed ? [5, 3] : []);
            ctx.beginPath();
            ctx.moveTo(legendX, 14);
            ctx.lineTo(legendX + 20, 14);
            ctx.stroke();
            ctx.setLineDash([]);

            const text = `${item.name} ${item.value}%`;

            ctx.fillStyle = COLOR_TEXT;
            ctx.fillText(text, legendX + 28, 14);

            legendX += 28 + ctx.measureText(text).width + 24;

        });

        // --- Подсказка при наведении ---
        if (hoverX !== null && hoverX >= pad.left && hoverX <= pad.left + plotW) {

            const time = windowStart + ((hoverX - pad.left) / plotW) * WINDOW;

            const cpuHover = Math.round(valueAt("cpu", time));
            const ramHover = Math.round(valueAt("ram", time));

            const secondsAgo = Math.max(0, Math.round((renderTime - time) / 1000));

            const lineX = Math.round(hoverX) + 0.5;

            ctx.strokeStyle = COLOR_BORDER;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lineX, pad.top);
            ctx.lineTo(lineX, pad.top + plotH);
            ctx.stroke();

            const lines = [
                secondsAgo === 0 ? "Сейчас" : `${secondsAgo} сек. назад`,
                `CPU: ${cpuHover}%`,
                `RAM: ${ramHover}%`
            ];

            ctx.font = `12px ${FONT}`;

            const boxW = Math.max(...lines.map(line => ctx.measureText(line).width)) + 24;
            const boxH = lines.length * 18 + 14;

            let boxX = hoverX + 14;

            if (boxX + boxW > width - 4) {
                boxX = hoverX - 14 - boxW;
            }

            const boxY = pad.top + 6;

            roundedRect(boxX, boxY, boxW, boxH, 8);
            ctx.fillStyle = COLOR_SURFACE;
            ctx.fill();
            ctx.strokeStyle = COLOR_BORDER;
            ctx.stroke();

            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            lines.forEach((line, index) => {
                ctx.fillStyle = index === 0 ? COLOR_MUTED : COLOR_TEXT;
                ctx.fillText(line, boxX + 12, boxY + 7 + index * 18 + 9);
            });

        }

    }


    // ======================================
    // Запуск
    // ======================================

    // Новое значение каждую секунду
    setInterval(() => {

        pushSample(Date.now());

        if (reduceMotion) draw();

    }, SAMPLE_INTERVAL);

    // Если вкладка была скрыта, сразу добавляем свежую точку
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) pushSample(Date.now());
    });

    // Плавная анимация: график непрерывно «едет» влево
    function frame() {
        draw();
        requestAnimationFrame(frame);
    }

    resize();

    if (reduceMotion) {
        draw();
    } else {
        requestAnimationFrame(frame);
    }

}
