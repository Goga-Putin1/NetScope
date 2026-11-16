// ==========================================
// NetScope — Settings
// (демо: всё хранится только в localStorage)
// ==========================================


// Начальные тестовые устройства
const defaultDevices = [
    {
        name: "Main-PC",
        ip: "192.168.1.10",
        cpu: 24,
        ram: 58,
        online: true
    },
    {
        name: "Gaming-PC",
        ip: "192.168.1.11",
        cpu: 67,
        ram: 72,
        online: true
    },
    {
        name: "Office-PC",
        ip: "192.168.1.12",
        cpu: 0,
        ram: 0,
        online: false
    }
];

const STORAGE_KEY = "netscope-devices";

// Формат кода: NS-XXXX-XXXX (8 символов после префикса)
const CODE_PREFIX = "NS";
const CODE_BODY_LENGTH = 8;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";


// Инициализация хранилища
try {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(defaultDevices)
        );
    }
} catch (error) {
    console.error("Хранилище недоступно:", error);
}


// Получение устройств
function getDevices() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        );

        return Array.isArray(saved) ? saved : [...defaultDevices];
    } catch {
        return [...defaultDevices];
    }
}


// Сохранение устройств
function saveDevices(devices) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(devices)
        );
    } catch (error) {
        console.error("Не удалось сохранить устройства:", error);
    }
}


// Элементы страницы
const deviceList = document.getElementById("settings-device-list");

const addForm = document.getElementById("add-device-form");

const showAddButton = document.getElementById("show-add-device");

const cancelButton = document.getElementById("cancel-add-device");

const submitButton = document.getElementById("submit-add-device");

const demoCodeButton = document.getElementById("fill-demo-code");

const codeInput = document.getElementById("device-code");

const message = document.getElementById("device-form-message");


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
// Уведомление
// ==========================================

let toastTimer = null;

function showToast(text) {

    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <span class="status-dot online"></span>
        <span>${escapeHTML(text)}</span>
    `;

    // Перезапуск анимации, если уведомление уже показано
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);

}


// ==========================================
// Отображение устройств
// ==========================================

function renderDevices() {

    const devices = getDevices();

    if (devices.length === 0) {
        deviceList.innerHTML = `
            <p class="empty-message">
                Пока нет подключённых устройств. Нажмите «Добавить устройство» и введите код.
            </p>
        `;
        return;
    }

    deviceList.innerHTML = devices.map((device, index) => `

        <div class="settings-device">

            <div class="settings-device-icon">
                <span>PC</span>
            </div>

            <div class="settings-device-info">
                <strong>${escapeHTML(device.name)}</strong>
                <span>${escapeHTML(device.ip)}</span>
                ${device.code
                    ? `<span class="device-code">${escapeHTML(device.code)}</span>`
                    : ""}
            </div>

            <span class="device-status ${device.online ? "online" : "offline"}">
                <span class="status-dot ${device.online ? "online" : "offline"}"></span>
                ${device.online ? "Online" : "Offline"}
            </span>

            <button
                class="remove-device-button"
                data-index="${index}"
                type="button"
                title="Удалить устройство"
                aria-label="Удалить ${escapeHTML(device.name)}"
            >
                ×
            </button>

        </div>

    `).join("");
}


// ==========================================
// Код устройства
// ==========================================

// Приводит ввод к формату NS-XXXX-XXXX
function formatCode(rawValue, isDeleting) {

    let clean = rawValue
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    // Префикс NS добавляется автоматически
    if (clean.startsWith(CODE_PREFIX)) {
        clean = clean.slice(CODE_PREFIX.length);
    }

    const body = clean.slice(0, CODE_BODY_LENGTH);

    // Позволяем стереть префикс целиком
    if (body.length === 0) {
        return isDeleting ? "" : `${CODE_PREFIX}-`;
    }

    return body.length > 4
        ? `${CODE_PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`
        : `${CODE_PREFIX}-${body}`;

}


// Возвращает 8 символов кода или пустую строку
function getCodeBody(value) {
    return value.replace(/[^A-Z0-9]/gi, "").slice(CODE_PREFIX.length);
}


// Генерация демо-кода
function generateDemoCode() {

    const randomChar = () =>
        CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];

    const body = Array.from({ length: CODE_BODY_LENGTH }, randomChar).join("");

    return `${CODE_PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;

}


// Свободный IP для нового устройства (демо)
function getFreeIP(devices) {

    const used = new Set(devices.map(device => device.ip));

    for (let last = 13; last < 255; last++) {
        const ip = `192.168.1.${last}`;

        if (!used.has(ip)) return ip;
    }

    return "192.168.1.254";

}


function randomBetween(min, max) {
    return Math.round(min + Math.random() * (max - min));
}


// Сообщения формы
function showMessage(text, type) {
    message.textContent = text;
    message.className = `form-message ${type}`;
}

function clearMessage() {
    message.textContent = "";
    message.className = "form-message";
    codeInput.classList.remove("invalid");
}

function resetForm() {
    addForm.reset();
    clearMessage();
    submitButton.disabled = false;
    submitButton.textContent = "Подключить";
}


// ==========================================
// Форма добавления устройства
// ==========================================

let addTimer = null;


// Открытие формы
showAddButton.addEventListener("click", () => {

    addForm.hidden = false;
    clearMessage();

    codeInput.focus();

});


// Закрытие формы
cancelButton.addEventListener("click", () => {

    clearTimeout(addTimer);

    addForm.hidden = true;
    resetForm();

});


// Подстановка демо-кода
demoCodeButton.addEventListener("click", () => {

    codeInput.value = generateDemoCode();

    clearMessage();
    codeInput.focus();

});


// Автоформатирование кода при вводе
codeInput.addEventListener("input", event => {

    const isDeleting = Boolean(
        event.inputType && event.inputType.startsWith("delete")
    );

    codeInput.value = formatCode(codeInput.value, isDeleting);

    clearMessage();

});


// Вставка целого кода из буфера обмена
codeInput.addEventListener("paste", event => {

    const pasted = event.clipboardData
        ? event.clipboardData.getData("text")
        : "";

    if (!pasted) return;

    event.preventDefault();

    codeInput.value = formatCode(pasted, false);

    clearMessage();

});


// Префикс появляется при фокусе
codeInput.addEventListener("focus", () => {

    if (!codeInput.value) {
        codeInput.value = `${CODE_PREFIX}-`;
    }

});


// Пустое поле без префикса, чтобы был виден placeholder
codeInput.addEventListener("blur", () => {

    if (codeInput.value === `${CODE_PREFIX}-`) {
        codeInput.value = "";
    }

});


// Добавление устройства по коду
addForm.addEventListener("submit", event => {

    event.preventDefault();

    const body = getCodeBody(codeInput.value);

    if (body.length !== CODE_BODY_LENGTH) {

        codeInput.classList.add("invalid");

        showMessage(
            "Введите полный код из 8 символов, например NS-7K4M-X9P2.",
            "error"
        );

        codeInput.focus();

        return;

    }

    const code = `${CODE_PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;

    const devices = getDevices();

    if (devices.some(device => device.code === code)) {

        codeInput.classList.add("invalid");

        showMessage("Это устройство уже подключено.", "error");

        return;

    }

    // Имитация проверки кода (демо)
    submitButton.disabled = true;
    submitButton.textContent = "Проверяем код…";

    clearMessage();

    addTimer = setTimeout(() => {

        const current = getDevices();

        const newDevice = {
            name: `PC-${body.slice(4)}`,
            ip: getFreeIP(current),
            code: code,
            cpu: randomBetween(8, 45),
            ram: randomBetween(30, 65),
            online: true
        };

        current.push(newDevice);

        saveDevices(current);

        renderDevices();

        addForm.hidden = true;
        resetForm();

        showToast(`Устройство ${newDevice.name} подключено`);

    }, 900);

});


// ==========================================
// Удаление устройства (подтверждение на месте)
// ==========================================

let confirmTimer = null;

function cancelRemoveConfirmation() {

    clearTimeout(confirmTimer);

    document
        .querySelectorAll(".remove-device-button.confirming")
        .forEach(button => {
            button.classList.remove("confirming");
            button.textContent = "×";
        });

}

deviceList.addEventListener("click", event => {

    const button = event.target.closest(".remove-device-button");

    if (!button) return;

    // Первое нажатие просит подтверждение
    if (!button.classList.contains("confirming")) {

        cancelRemoveConfirmation();

        button.classList.add("confirming");
        button.textContent = "Удалить?";

        confirmTimer = setTimeout(cancelRemoveConfirmation, 3000);

        return;

    }

    // Второе нажатие удаляет устройство
    clearTimeout(confirmTimer);

    const index = Number(button.dataset.index);

    const devices = getDevices();

    if (!Number.isInteger(index) || index < 0 || index >= devices.length) {
        return;
    }

    const [removed] = devices.splice(index, 1);

    saveDevices(devices);

    renderDevices();

    showToast(`Устройство ${removed.name} удалено`);

});


// Первоначальное отображение
renderDevices();
