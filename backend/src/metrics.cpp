#include "metrics.h"

#include <windows.h>
#include <string>

double getCpuUsage()
{
    static ULONGLONG previousIdle = 0;
    static ULONGLONG previousKernel = 0;
    static ULONGLONG previousUser = 0;

    FILETIME idleTime, kernelTime, userTime;

    if (!GetSystemTimes(&idleTime, &kernelTime, &userTime))
        return -1.0;

    ULARGE_INTEGER idle, kernel, user;

    idle.LowPart = idleTime.dwLowDateTime;
    idle.HighPart = idleTime.dwHighDateTime;

    kernel.LowPart = kernelTime.dwLowDateTime;
    kernel.HighPart = kernelTime.dwHighDateTime;

    user.LowPart = userTime.dwLowDateTime;
    user.HighPart = userTime.dwHighDateTime;

    if (previousKernel == 0)
    {
        previousIdle = idle.QuadPart;
        previousKernel = kernel.QuadPart;
        previousUser = user.QuadPart;
        return 0.0;
    }

    ULONGLONG idleDiff = idle.QuadPart - previousIdle;
    ULONGLONG kernelDiff = kernel.QuadPart - previousKernel;
    ULONGLONG userDiff = user.QuadPart - previousUser;

    ULONGLONG total = kernelDiff + userDiff;

    previousIdle = idle.QuadPart;
    previousKernel = kernel.QuadPart;
    previousUser = user.QuadPart;

    if (total == 0)
        return 0.0;

    return 100.0 * (total - idleDiff) / total;
}

double getRamUsage()
{
    MEMORYSTATUSEX memoryStatus;

    memoryStatus.dwLength = sizeof(memoryStatus);

    if (!GlobalMemoryStatusEx(&memoryStatus))
        return -1.0;
    return static_cast<double>(memoryStatus.dwMemoryLoad);

}
std::string getComputerName()
{
    char computerName[MAX_COMPUTERNAME_LENGTH + 1];
    DWORD size = sizeof(computerName);

    if (!GetComputerNameA(computerName, &size))
        return "Unknown";

    return std::string(computerName);
}

std::string getWindowsVersion()
{
    OSVERSIONINFOEXA versionInfo{};
    versionInfo.dwOSVersionInfoSize = sizeof(versionInfo);

    // Версию Windows пока получим через системную информацию.
    SYSTEM_INFO systemInfo{};
    GetNativeSystemInfo(&systemInfo);

    return "Windows (build information unavailable)";
}

double getTotalRamGB()
{
    MEMORYSTATUSEX memoryStatus{};
    memoryStatus.dwLength = sizeof(memoryStatus);

    if (!GlobalMemoryStatusEx(&memoryStatus))
        return -1.0;

    return static_cast<double>(memoryStatus.ullTotalPhys)
        / (1024.0 * 1024.0 * 1024.0);
}

double getUsedRamGB()
{
    MEMORYSTATUSEX memoryStatus{};
    memoryStatus.dwLength = sizeof(memoryStatus);

    if (!GlobalMemoryStatusEx(&memoryStatus))
        return -1.0;

    ULONGLONG used = memoryStatus.ullTotalPhys
        - memoryStatus.ullAvailPhys;

    return static_cast<double>(used)
        / (1024.0 * 1024.0 * 1024.0);
}