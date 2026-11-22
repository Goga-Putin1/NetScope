#include <filesystem>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include <httplib.h>

#include "metrics.h"

namespace {

std::string escapeJson(const std::string& value)
{
    std::ostringstream escaped;

    for (const unsigned char character : value) {
        switch (character) {
        case '"': escaped << "\\\""; break;
        case '\\': escaped << "\\\\"; break;
        case '\b': escaped << "\\b"; break;
        case '\f': escaped << "\\f"; break;
        case '\n': escaped << "\\n"; break;
        case '\r': escaped << "\\r"; break;
        case '\t': escaped << "\\t"; break;
        default:
            if (character < 0x20) {
                escaped << "\\u" << std::hex << std::setw(4)
                        << std::setfill('0') << static_cast<int>(character)
                        << std::dec << std::setfill(' ');
            } else {
                escaped << character;
            }
        }
    }

    return escaped.str();
}

std::filesystem::path findFrontendDirectory()
{
    const std::vector<std::filesystem::path> candidates = {
        "frontent",
        "../frontent",
        "../../frontent",
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

} // namespace

int main()
{
    std::cout << "========== NetScope Backend ==========" << std::endl;

    const auto frontendDirectory = findFrontendDirectory();
    if (frontendDirectory.empty()) {
        std::cerr << "ERROR: Frontend folder not found. Start the server from the project root, backend, or build directory." << std::endl;
        return 1;
    }

    httplib::Server server;

    if (!server.set_mount_point("/", frontendDirectory.string().c_str())) {
        std::cerr << "ERROR: Could not mount frontend folder: "
                  << frontendDirectory.string() << std::endl;
        return 1;
    }

    server.Get("/api/metrics", [](const httplib::Request&, httplib::Response& response) {
        std::ostringstream json;
        json << std::fixed << std::setprecision(2)
             << "{"
             << "\"computer\":\"" << escapeJson(getComputerName()) << "\","
             << "\"windows\":\"" << escapeJson(getWindowsVersion()) << "\","
             << "\"cpu_usage\":" << getCpuUsage() << ","
             << "\"ram_usage\":" << getRamUsage() << ","
             << "\"ram_used_gb\":" << getUsedRamGB() << ","
             << "\"ram_total_gb\":" << getTotalRamGB()
             << "}";

        response.set_content(json.str(), "application/json; charset=UTF-8");
        response.set_header("Cache-Control", "no-store");
        response.set_header("Access-Control-Allow-Origin", "*");
    });

    std::cout << "NetScope HTTP Server started!" << std::endl;
    std::cout << "Dashboard: http://<server-ip>:8080/" << std::endl;
    std::cout << "API: http://<server-ip>:8080/api/metrics" << std::endl;

    if (!server.listen("0.0.0.0", 8080)) {
        std::cerr << "ERROR: Could not start HTTP server on port 8080. Check the firewall or another running process." << std::endl;
        return 1;
    }

    return 0;
}
