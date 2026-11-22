#include "metrics.h"

#include <httplib.h>

#include <chrono>
#include <cstdlib>
#include <iomanip>
#include <sstream>
#include <iostream>
#include <string>
#include <thread>

namespace {
std::string toString(double value)
{
    std::ostringstream out;
    out << std::fixed << std::setprecision(2) << value;
    return out.str();
}
}

int main(int argc, char* argv[])
{
    if (argc < 2) {
        std::cerr << "Usage: netscope_agent.exe <server-ip> [port]\n"
                  << "Example: netscope_agent.exe 100.112.31.54 8080\n";
        return 1;
    }

    const std::string serverHost = argv[1];
    const int serverPort = (argc >= 3) ? std::atoi(argv[2]) : 8080;
    if (serverPort < 1 || serverPort > 65535) {
        std::cerr << "Invalid port.\n";
        return 1;
    }

    httplib::Client client(serverHost, serverPort);
    client.set_connection_timeout(3, 0);
    client.set_read_timeout(3, 0);
    client.set_write_timeout(3, 0);
    client.set_keep_alive(false);

    std::cout << "NetScope C++ Agent\n"
              << "Computer: " << getComputerName() << "\n"
              << "Sending metrics to http://" << serverHost << ":" << serverPort
              << "/api/agent/metrics\n"
              << "Press Ctrl+C to stop.\n";

    while (true) {
        // getCpuUsage() calculates usage between consecutive samples.
        const double cpu = getCpuUsage();
        const double ram = getRamUsage();
        const double usedRam = getUsedRamGB();
        const double totalRam = getTotalRamGB();

        httplib::Params params;
        params.emplace("computer", getComputerName());
        params.emplace("windows", getWindowsVersion());
        params.emplace("cpu_usage", toString(cpu));
        params.emplace("ram_usage", toString(ram));
        params.emplace("ram_used_gb", toString(usedRam));
        params.emplace("ram_total_gb", toString(totalRam));

        auto response = client.Post("/api/agent/metrics", params);
        if (response && response->status == 200) {
            std::cout << "\rSent: CPU " << std::fixed << std::setprecision(1)
                      << cpu << "% | RAM " << ram << "%          " << std::flush;
        } else if (response) {
            std::cerr << "\nServer returned HTTP " << response->status << "\n";
        } else {
            std::cerr << "\nCannot reach NetScope server at "
                      << serverHost << ":" << serverPort
                      << ". Retrying in 2 seconds...\n";
        }

        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    return 0;
}
