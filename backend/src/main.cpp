
#include <iostream>
#include <sstream>
#include <iomanip>
#include <httplib.h>

#include "metrics.h"

int main()
{
    std::cout << "========== NetScope Backend ==========" << std::endl;

    httplib::Server server;

    // Раздача frontend-файлов
    if (!server.set_mount_point("/", "../frontent"))
    {
        std::cerr << "ERROR: Frontend folder not found!" << std::endl;
        return 1;
    }

    // API метрик
    server.Get("/api/metrics", [](const httplib::Request& req,
        httplib::Response& res)
        {
            double cpu = getCpuUsage();
            double ram = getRamUsage();
            double usedRam = getUsedRamGB();
            double totalRam = getTotalRamGB();

            std::ostringstream json;
            json << std::fixed << std::setprecision(2);

            json << "{"
                << "\"computer\":\"" << getComputerName() << "\","
                << "\"windows\":\"" << getWindowsVersion() << "\","
                << "\"cpu_usage\":" << cpu << ","
                << "\"ram_usage\":" << ram << ","
                << "\"ram_used_gb\":" << usedRam << ","
                << "\"ram_total_gb\":" << totalRam
                << "}";

            res.set_content(json.str(), "application/json");
        });

    std::cout << "NetScope HTTP Server started!" << std::endl;
    std::cout << "Dashboard: http://localhost:8080/" << std::endl;
    std::cout << "API: http://localhost:8080/api/metrics" << std::endl;

    server.listen("127.0.0.1", 8080);

    return 0;
}
               