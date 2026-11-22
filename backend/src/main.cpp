#include <chrono>
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
#include <cmath>

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
        return used == raw.size() && std::isfinite(value) && value >= 0.0 && value <= 100.0;
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
    local.ip = "127.0.0.1";
    local.windows = getWindowsVersion();
    local.cpu = std::max(0.0, getCpuUsage());
    local.ram = std::max(0.0, getRamUsage());
    local.ramUsed = std::max(0.0, getUsedRamGB());
    local.ramTotal = std::max(0.0, getTotalRamGB());
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
             << "\"cpu_usage\":" << (online ? d.cpu : 0.0) << ","
             << "\"ram_usage\":" << (online ? d.ram : 0.0) << ","
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
    const int port = argc > 1 ? std::stoi(argv[1]) : 8080;
    if (port < 1 || port > 65535) {
        std::cerr << "Invalid port." << std::endl;
        return 1;
    }

    std::cout << "========== NetScope Backend ==========" << std::endl;
    const auto frontendDirectory = findFrontendDirectory();
    if (frontendDirectory.empty()) {
        std::cerr << "ERROR: Frontend folder not found." << std::endl;
        return 1;
    }

    std::thread localMetricsThread([] {
        while (true) {
            updateLocalDevice();
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    });
    localMetricsThread.detach();

    httplib::Server server;
    if (!server.set_mount_point("/", frontendDirectory.string().c_str())) {
        std::cerr << "ERROR: Could not mount frontend folder: " << frontendDirectory << std::endl;
        return 1;
    }

    server.Get("/api/metrics", [](const httplib::Request&, httplib::Response& response) {
        response.set_content(devicesJson(), "application/json; charset=UTF-8");
        response.set_header("Cache-Control", "no-store");
        response.set_header("Access-Control-Allow-Origin", "*");
    });

    server.Post("/api/agent/metrics", [](const httplib::Request& req, httplib::Response& response) {
        if (!req.has_param("computer") || !req.has_param("windows")) {
            response.status = 400;
            response.set_content("Missing computer/windows", "text/plain");
            return;
        }

        DeviceMetrics incoming;
        incoming.computer = req.get_param_value("computer");
        incoming.ip = req.remote_addr;
        incoming.windows = req.get_param_value("windows");
        if (incoming.computer.empty() || incoming.computer.size() > 128 ||
            !readDouble(req, "cpu_usage", incoming.cpu) ||
            !readDouble(req, "ram_usage", incoming.ram) ||
            !readDouble(req, "ram_used_gb", incoming.ramUsed) ||
            !readDouble(req, "ram_total_gb", incoming.ramTotal)) {
            response.status = 400;
            response.set_content("Invalid metrics payload", "text/plain");
            return;
        }

        incoming.lastSeen = nowUnix();
        std::lock_guard<std::mutex> lock(devicesMutex);
        auto& stored = devices[incoming.computer];
        stored.computer = incoming.computer;
        stored.ip = incoming.ip;
        stored.windows = incoming.windows;
        stored.cpu = incoming.cpu;
        stored.ram = incoming.ram;
        stored.ramUsed = incoming.ramUsed;
        stored.ramTotal = incoming.ramTotal;
        stored.lastSeen = incoming.lastSeen;
        addSample(stored);
        response.set_content("OK", "text/plain");
    });

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

    std::cout << "NetScope HTTP Server started on port " << port << std::endl;
    if (!server.listen("0.0.0.0", port)) {
        std::cerr << "ERROR: Could not start HTTP server on port 8080." << std::endl;
        return 1;
    }
    return 0;
}
