#pragma once
#include <string>
#include <vector>

struct VideoFormatInfo {
    unsigned int fourcc;
    int width;
    int height;
    int fps_num;
    int fps_den;
};

struct VideoDeviceInfo {
    std::string path;
    bool opened = false;
    bool querycap_ok = false;
    std::string driver;
    std::string card;
    std::string bus_info;
    unsigned int capabilities = 0;
    std::vector<VideoFormatInfo> formats;
    std::string error;
};

std::vector<VideoDeviceInfo> probe_video_devices();
std::string device_info_to_json(const std::vector<VideoDeviceInfo>& list);
bool capture_one_frame(const std::string& dev,
                       int reqWidth,
                       int reqHeight,
                       unsigned int reqFourcc,
                       std::vector<unsigned char>& out,
                       int& actualWidth,
                       int& actualHeight,
                       unsigned int& actualFourcc,
                       std::string& error);
