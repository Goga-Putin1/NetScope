#include <winsock2.h>
#include <iphlpapi.h>
#include <ws2tcpip.h>

#include <deque>
#include <filesystem>
#include <iomanip>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>
#include <chrono>
#include <cmath>
#include <cstdlib>

#include <httplib.h>
#include "metrics.h"

namespace {

struct MetricSample {
    long long timestamp = 0;
    double cpu = 0.0;
    double ram = 0.0;
};

struct DeviceMetrics {
    std::string computer;
    std::string ip;
    std::string windows;
    double cpu = 0.0;
    double ram = 0.0;
    double ramUsed = 0.0;
    double ramTotal = 0.0;
    long long lastSeen = 0;
    std::deque<MetricSample> history;
};

std::mutex devicesMutex;
std::map<std::string, DeviceMetrics> devices;

std::vector<std::string> getLocalIPv4Addresses()
{
    ULONG bufferSize = 15000;
    std::vector<char> buffer(bufferSize);
    auto* adapters = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());
    ULONG result = GetAdaptersAddresses(AF_INET, GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER, nullptr, adapters, &bufferSize);
    if (result == ERROR_BUFFER_OVERFLOW) {
        buffer.resize(bufferSize);
        adapters = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());
        result = GetAdaptersAddresses(AF_INET, GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER, nullptr, adapters, &bufferSize);
    }

    std::vector<std::string> addresses;
    if (result != NO_ERROR) return addresses;
    for (auto* adapter = adapters; adapter; adapter = adapter->Next) {
        if (adapter->OperStatus != IfOperStatusUp || adapter->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
        for (auto* address = adapter->FirstUnicastAddress; address; address = address->Next) {
            char text[INET_ADDRSTRLEN] = {};
            const auto* ipv4 = reinterpret_cast<const sockaddr_in*>(address->Address.lpSockaddr);
            if (InetNtopA(AF_INET, const_cast<IN_ADDR*>(&ipv4->sin_addr), text, sizeof(text))) {
                addresses.emplace_back(text);
            }
        }
    }
    return addresses;
}

long long nowUnix()
{
    return std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}

std::string escapeJson(const std::string& value)
{
    std::ostringstream escaped;
    for (const unsigned char c : value) {
        switch (c) {
        case '"': escaped << "\\\""; break;
        case '\\': escaped << "\\\\"; break;
        case '\b': escaped << "\\b"; break;
        case '\f': escaped << "\\f"; break;
        case '\n': escaped << "\\n"; break;
        case '\r': escaped << "\\r"; break;
        case '\t': escaped << "\\t"; break;
        default:
            if (c < 0x20) {
                escaped << "\\u" << std::hex << std::setw(4)
                        << std::setfill('0') << static_cast<int>(c)
                        << std::dec << std::setfill(' ');
            } else {
                escaped << c;
            }
        }
    }
    return escaped.str();
}

bool readDouble(const httplib::Request& req, const char* key, double& value)
{
    if (!req.has_param(key)) return false;
    try {
        const std::string raw = req.get_param_value(key);
        size_t used = 0;
        value = std::stod(raw, &used);
        return used == raw.size() && std::isfinite(value);
    } catch (...) {
        return false;
    }
}

std::filesystem::path findFrontendDirectory()
{
    const std::vector<std::filesystem::path> candidates = {
        "frontent", "../frontent", "../../frontent",
        std::filesystem::path(__FILE__).parent_path() / "../../frontent"
    };
    for (const auto& candidate : candidates) {
        std::error_code error;
        if (std::filesystem::is_directory(candidate, error) &&
            std::filesystem::exists(candidate / "index.html", error)) {
            return std::filesystem::weakly_canonical(candidate, error);
        }
    }
    return {};
}

void addSample(DeviceMetrics& device)
{
    device.history.push_back({device.lastSeen, device.cpu, device.ram});
    while (device.history.size() > 180) device.history.pop_front();
}

void updateLocalDevice()
{
    DeviceMetrics local;
    local.computer = getComputerName();
    const auto addresses = getLocalIPv4Addresses();
    local.ip = addresses.empty() ? "127.0.0.1" : addresses.front();
    local.windows = getWindowsVersion();
    local.cpu = getCpuUsage();
    local.ram = getRamUsage();
    local.ramUsed = getUsedRamGB();
    local.ramTotal = getTotalRamGB();
    local.lastSeen = nowUnix();

    std::lock_guard<std::mutex> lock(devicesMutex);
    auto& stored = devices[local.computer];
    stored.computer = local.computer;
    stored.ip = local.ip;
    stored.windows = local.windows;
    stored.cpu = local.cpu;
    stored.ram = local.ram;
    stored.ramUsed = local.ramUsed;
    stored.ramTotal = local.ramTotal;
    stored.lastSeen = local.lastSeen;
    addSample(stored);
}

std::string devicesJson()
{
    std::ostringstream json;
    json << std::fixed << std::setprecision(2) << "[";
    std::lock_guard<std::mutex> lock(devicesMutex);
    bool first = true;
    const long long now = nowUnix();

    for (const auto& item : devices) {
        const auto& d = item.second;
        if (!first) json << ",";
        first = false;
        const bool online = (now - d.lastSeen) <= 10;
        json << "{"
             << "\"computer\":\"" << escapeJson(d.computer) << "\","
             << "\"ip\":\"" << escapeJson(d.ip) << "\","
             << "\"windows\":\"" << escapeJson(d.windows) << "\","
             << "\"cpu_usage\":" << d.cpu << ","
             << "\"ram_usage\":" << d.ram << ","
             << "\"ram_used_gb\":" << d.ramUsed << ","
             << "\"ram_total_gb\":" << d.ramTotal << ","
             << "\"online\":" << (online ? "true" : "false") << ","
             << "\"last_seen\":" << d.lastSeen
             << "}";
    }
    json << "]";
    return json.str();
}

std::string historyJson(const std::string& computer)
{
    std::ostringstream json;
    json << std::fixed << std::setprecision(2) << "[";
    std::lock_guard<std::mutex> lock(devicesMutex);
    const auto it = devices.find(computer);
    if (it == devices.end()) return "[]";

    bool first = true;
    for (const auto& sample : it->second.history) {
        if (!first) json << ",";
        first = false;
        json << "{\"timestamp\":" << sample.timestamp
             << ",\"cpu\":" << sample.cpu
             << ",\"ram\":" << sample.ram << "}";
    }
    json << "]";
    return json.str();
}

} // namespace

int main(int argc, char* argv[])
{
    const int port = argc > 1 ? std::atoi(argv[1]) : 8080;
    if (port < 1 || port > 65535) {
        std::cerr << "Invalid port." << std::endl;
        return 1;
    }

    std::cout << "========== NetScope Backend ==========" << std::endl;
    const auto frontendDirectory = findFrontendDirectory();
    if (frontendDirectory.empty()) {
        std::cerr << "ERROR: Frontend folder not found. Start the server from the project root, backend, or build directory." << std::endl;
        return 1;
    }

    // The main PC also reports itself, so /api/devices contains both PCs.
    std::thread localMetricsThread([] {
        while (true) {
            updateLocalDevice();
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    });
    localMetricsThread.detach();

    httplib::Server server;
    if (!server.set_mount_point("/", frontendDirectory.string().c_str())) {
        std::cerr << "ERROR: Could not mount frontend folder: "
                  << frontendDirectory.string() << std::endl;
        return 1;
    }

    // Backward-compatible endpoint for the existing dashboard.
    server.Get("/api/metrics", [](const httplib::Request&, httplib::Response& response) {
        const std::string localName = getComputerName();
        DeviceMetrics local;
        {
            std::lock_guard<std::mutex> lock(devicesMutex);
            const auto it = devices.find(localName);
            if (it == devices.end()) {
                response.status = 503;
                response.set_content("Local metrics are not ready yet", "text/plain");
                return;
            }
            local = it->second;
        }

        std::ostringstream json;
        json << std::fixed << std::setprecision(2)
             << "{"
             << "\"computer\":\"" << escapeJson(local.computer) << "\","
             << "\"windows\":\"" << escapeJson(local.windows) << "\","
             << "\"cpu_usage\":" << local.cpu << ","
             << "\"ram_usage\":" << local.ram << ","
             << "\"ram_used_gb\":" << local.ramUsed << ","
             << "\"ram_total_gb\":" << local.ramTotal
             << "}";
        response.set_content(json.str(), "application/json; charset=UTF-8");
        response.set_header("Cache-Control", "no-store");
        response.set_header("Access-Control-Allow-Origin", "*");
    });

    // C++ agents POST their latest sample here using form-urlencoded fields.
    server.Post("/api/agent/metrics", [](const httplib::Request& req, httplib::Response& response) {
        if (!req.has_param("computer") || !req.has_param("windows")) {
            response.status = 400;
            response.set_content("Missing computer/windows", "text/plain");
            return;
        }

        DeviceMetrics d;
        d.computer = req.get_param_value("computer");
        d.ip = req.remote_addr;
        d.windows = req.get_param_value("windows");

        if (d.computer.empty() || d.computer.size() > 128 ||
            !readDouble(req, "cpu_usage", d.cpu) ||
            !readDouble(req, "ram_usage", d.ram) ||
            !readDouble(req, "ram_used_gb", d.ramUsed) ||
            !readDouble(req, "ram_total_gb", d.ramTotal)) {
            response.status = 400;
            response.set_content("Invalid metrics payload", "text/plain");
            return;
        }

        d.lastSeen = nowUnix();
        {
            std::lock_guard<std::mutex> lock(devicesMutex);
            auto& stored = devices[d.computer];
            stored.computer = d.computer;
            stored.ip = d.ip;
            stored.windows = d.windows;
            stored.cpu = d.cpu;
            stored.ram = d.ram;
            stored.ramUsed = d.ramUsed;
            stored.ramTotal = d.ramTotal;
            stored.lastSeen = d.lastSeen;
            addSample(stored);
        }
        response.set_content("OK", "text/plain");
    });

    // New endpoint: array of all known computers and their latest metrics.
    server.Get("/api/devices", [](const httplib::Request&, httplib::Response& response) {
        response.set_content(devicesJson(), "application/json; charset=UTF-8");
        response.set_header("Cache-Control", "no-store");
        response.set_header("Access-Control-Allow-Origin", "*");
    });

    server.Get("/api/device/history", [](const httplib::Request& req, httplib::Response& response) {
        if (!req.has_param("computer")) {
            response.status = 400;
            response.set_content("Missing computer", "text/plain");
            return;
        }
        response.set_content(historyJson(req.get_param_value("computer")), "application/json; charset=UTF-8");
        response.set_header("Cache-Control", "no-store");
        response.set_header("Access-Control-Allow-Origin", "*");
    });

    server.Get("/api/server-info", [port](const httplib::Request&, httplib::Response& response) {
        const auto addresses = getLocalIPv4Addresses();
        std::ostringstream json;
        json << "{\"port\":" << port << ",\"addresses\":[";
        for (size_t index = 0; index < addresses.size(); ++index) {
            if (index) json << ",";
            json << "\"" << escapeJson(addresses[index]) << "\"";
        }
        json << "]}";
        response.set_content(json.str(), "application/json; charset=UTF-8");
        response.set_header("Cache-Control", "no-store");
    });

    std::cout << "NetScope HTTP Server started on port " << port << std::endl;
    const auto serverAddresses = getLocalIPv4Addresses();
    for (const auto& address : serverAddresses) {
        std::cout << "Dashboard: http://" << address << ":" << port << "/" << std::endl;
        std::cout << "Agent command: netscope_agent.exe " << address << " " << port << std::endl;
    }
    std::cout << "Devices API: http://<server-ip>:" << port << "/api/devices" << std::endl;
    std::cout << "Agent endpoint: POST http://<server-ip>:" << port << "/api/agent/metrics" << std::endl;

    if (!server.listen("0.0.0.0", port)) {
        std::cerr << "ERROR: Could not start HTTP server on port " << port
                  << ". Check the firewall or another running process." << std::endl;
        return 1;
    }
    return 0;
}
