#include <iostream>
#include <windows.h>
#include <iomanip>

#include "metrics.h"

int main()
{
    std::cout << "========== NetScope Backend ==========" << std::endl;

    std::cout << "Computer: " << getComputerName() << std::endl;
    std::cout << "Windows: " << getWindowsVersion() << std::endl;

    std::cout << std::fixed << std::setprecision(2);

    std::cout << "Total RAM: " << getTotalRamGB() << " GB" << std::endl;

    std::cout << "\n========== Live Monitoring ==========" << std::endl;

    while (true)
    {
        double cpu = getCpuUsage();
        double ram = getRamUsage();
        double usedRam = getUsedRamGB();

        std::cout
            << "CPU: " << cpu << "%"
            << " | RAM: " << ram << "%"
            << " | Used RAM: " << usedRam << " GB"
            << std::endl;

        Sleep(1000);
    }

    return 0;
}