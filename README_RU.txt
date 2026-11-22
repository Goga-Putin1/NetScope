NetScope: C++ агент и сервер

Что входит:
- src/agent.cpp — отдельный C++ агент. Сам собирает CPU/RAM и отправляет их на сервер раз в секунду.
- src/main.cpp — сервер, принимает метрики агентов через POST /api/agent/metrics.
- backend_CMakeLists.txt — CMake-конфигурация для двух exe.

Важно:
1. Это исходники для интеграции в существующую папку backend проекта NetScope.
2. Переименуйте backend_CMakeLists.txt в CMakeLists.txt и замените им backend/CMakeLists.txt.
3. Замените backend/src/main.cpp новым src/main.cpp.
4. Добавьте src/agent.cpp.
5. Существующие backend/src/metrics.cpp и backend/include/metrics.h оставьте без изменений.
6. Сборка создаст netscope_backend.exe и netscope_agent.exe.

Сборка (PowerShell, из папки backend):
cmake -S . -B build
cmake --build build --config Release

Запуск главного сервера на вашем ПК:
.\build\Release\netscope_backend.exe

Запуск агента на ПК брата (в отдельном PowerShell):
.\build\Release\netscope_agent.exe <server-ip> 8080

Проверка на главном ПК:
http://localhost:8080/api/devices

В ответе должен появиться JSON-массив с компьютером-хостом и компьютером брата.

Агент работает без браузера. Браузер нужен только для просмотра Dashboard.
Сервер должен быть запущен на главном ПК. На главном ПК уже созданное правило
Windows Firewall для TCP 8080 должно разрешать доступ из диапазона Tailscale.

Ограничения текущей версии:
- передаются CPU и RAM, как в существующем metrics.cpp;
- диск пока не реализован;
- /api/metrics сохранён для совместимости со старым frontend;
- для отображения двух устройств в интерфейсе frontend потребуется читать /api/devices.
- код подготовлен под Windows и cpp-httplib v0.18.3; сборку нужно проверить в вашей среде Visual Studio/CMake.
