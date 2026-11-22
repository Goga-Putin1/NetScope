
// ==========================================
// NetScope — Devices
// ==========================================


const DEFAULT_DEVICES = [
    { name: "Main-PC", ip: "192.168.1.10", cpu: 24, ram: 58, online: true },
    { name: "Gaming-PC", ip: "192.168.1.11", cpu: 67, ram: 72, online: true },
    { name: "Office-PC", ip: "192.168.1.12", cpu: 0, ram: 0, online: false }
];

function loadDevices() {
    try {
        const saved = JSON.parse(localStorage.getItem("netscope-devices") || "null");
        if (!Array.isArray(saved)) return DEFAULT_DEVICES;

        return saved.filter(device => device && typeof device === "object").map(device => ({
            name: String(device.name || "Unknown device"),
            ip: String(device.ip || ""),
            cpu: Number(device.cpu) || 0,
            ram: Number(device.ram) || 0,
            online: Boolean(device.online)
        }));
    } catch (error) {
        console.error("Не удалось загрузить устройства:", error);
        return DEFAULT_DEVICES;
    }
}

let devices = loadDevices();


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
// Получение HTML-элементов
// ==========================================

const table = document.getElementById("devices-table");

const searchInput = document.getElementById("device-search");

const statusFilter = document.getElementById("status-filter");

const sortFilter = document.getElementById("sort-filter");

const resetButton = document.getElementById("reset-filters");

const deviceCount = document.getElementById("device-count");


// ==========================================
// Отображение устройств
// ==========================================

function renderDevices() {

    // Получаем поисковый запрос
    const searchValue = searchInput.value
        .trim()
        .toLowerCase();

    // Получаем выбранный статус
    const selectedStatus = statusFilter.value;

    // Получаем способ сортировки
    const selectedSort = sortFilter.value;


    // ======================================
    // Поиск
    // ======================================

    let filteredDevices = devices.filter(device => {

        const matchesSearch =
            device.name.toLowerCase().includes(searchValue) ||
            device.ip.toLowerCase().includes(searchValue);

        return matchesSearch;

    });


    // ======================================
    // Фильтрация по статусу
    // ======================================

    if (selectedStatus === "online") {

        filteredDevices = filteredDevices.filter(
            device => device.online
        );

    } else if (selectedStatus === "offline") {

        filteredDevices = filteredDevices.filter(
            device => !device.online
        );

    }


    // ======================================
    // Сортировка
    // ======================================

    filteredDevices.sort((a, b) => {

        switch (selectedSort) {

            case "name-asc":
                return a.name.localeCompare(b.name);

            case "name-desc":
                return b.name.localeCompare(a.name);

            case "cpu-desc":
                return (b.online ? b.cpu : 0) - (a.online ? a.cpu : 0);

            case "cpu-asc":
                return (a.online ? a.cpu : 0) - (b.online ? b.cpu : 0);

            default:
                return 0;

        }

    });


    // ======================================
    // Обновление счётчика
    // ======================================

    deviceCount.textContent = filteredDevices.length;


    // ======================================
    // Отображение таблицы
    // ======================================

    if (filteredDevices.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty-message">
                    Устройства не найдены
                </td>
            </tr>
        `;

        return;

    }


    table.innerHTML = filteredDevices.map(device => `

        <tr>

            <td>
                <strong>${escapeHTML(device.name)}</strong>
            </td>

            <td>${escapeHTML(device.ip)}</td>

            <td>${device.online ? Number(device.cpu) || 0 : 0}%</td>

            <td>${device.online ? Number(device.ram) || 0 : 0}%</td>

            <td>
                <span class="device-status ${device.online ? "online" : "offline"}">
                    <span class="status-dot ${device.online ? "online" : "offline"}"></span>
                    ${device.online ? "Online" : "Offline"}
                </span>
            </td>

        </tr>

    `).join("");

}


// ==========================================
// Обработчики событий
// ==========================================


// Поиск
searchInput.addEventListener("input", renderDevices);

window.addEventListener("storage", event => {
    if (event.key !== "netscope-devices") return;
    devices = loadDevices();
    renderDevices();
});


// Фильтр статуса
statusFilter.addEventListener("change", renderDevices);


// Сортировка
sortFilter.addEventListener("change", renderDevices);


// ==========================================
// Сброс фильтров
// ==========================================

resetButton.addEventListener("click", () => {

    searchInput.value = "";

    statusFilter.value = "all";

    sortFilter.value = "name-asc";

    renderDevices();

});


// ==========================================
// Первоначальное отображение
// ==========================================

renderDevices();
