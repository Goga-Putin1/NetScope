const deviceList = document.getElementById("settings-device-list");
const addForm = document.getElementById("add-device-form");
const showAddButton = document.getElementById("show-add-device");
const cancelButton = document.getElementById("cancel-add-device");
const message = document.getElementById("device-form-message");

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

async function renderDevices() {
    try {
        const response = await fetch(`${window.location.origin}/api/devices`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const devices = await response.json();
        deviceList.innerHTML = devices.length ? devices.map(device => `
            <div class="settings-device">
                <div class="settings-device-icon"><span>PC</span></div>
                <div class="settings-device-info">
                    <strong>${escapeHTML(device.computer)}</strong>
                    <span>${escapeHTML(device.ip || "IP не определён")}</span>
                    <span>${escapeHTML(device.windows || "")}</span>
                </div>
                <span class="device-status ${device.online ? "online" : "offline"}">
                    <span class="status-dot ${device.online ? "online" : "offline"}"></span>
                    ${device.online ? "Online" : "Offline"}
                </span>
            </div>`).join("") : `<p class="empty-message">Нет подключённых устройств. Запустите агент на нужном компьютере.</p>`;
    } catch (error) {
        deviceList.innerHTML = `<p class="empty-message">Backend недоступен. Проверьте, что сервер NetScope запущен.</p>`;
        console.error("Не удалось получить устройства:", error);
    }
}

showAddButton.addEventListener("click", () => {
    addForm.hidden = false;
    message.textContent = "Запустите netscope_agent.exe <адрес-сервера> 8080 на компьютере для мониторинга.";
    message.className = "form-message";
});

cancelButton.addEventListener("click", () => {
    addForm.hidden = true;
    message.textContent = "";
});

renderDevices();
setInterval(renderDevices, 3000);
