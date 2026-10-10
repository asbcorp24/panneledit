#include "v4l2_probe.h"
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <linux/videodev2.h>
#include <dirent.h>
#include <cstring>
#include <sstream>
#include <algorithm>
#include <errno.h>

static std::string esc(const std::string& s){
    std::string o;
    for(char c: s){
        if(c=='\\' || c=='"') o.push_back('\\');
        if(c=='\n') { o += "\\n"; continue; }
        o.push_back(c);
    }
    return o;
}

static std::string fourcc_to_string(unsigned int f){
    char s[5] = {
        (char)(f & 0xff),
        (char)((f >> 8) & 0xff),
        (char)((f >> 16) & 0xff),
        (char)((f >> 24) & 0xff),
        0
    };
    return std::string(s);
}

std::vector<VideoDeviceInfo> probe_video_devices(){
    std::vector<VideoDeviceInfo> out;
    DIR* d = opendir("/dev");
    if(!d) return out;
    dirent* e;
    while((e = readdir(d)) != nullptr){
        if(strncmp(e->d_name, "video", 5) != 0) continue;
        bool numeric = true;
        for(const char* p = e->d_name + 5; *p; ++p) if(*p < '0' || *p > '9') numeric = false;
        if(!numeric) continue;
        VideoDeviceInfo info;
        info.path = std::string("/dev/") + e->d_name;
        int fd = open(info.path.c_str(), O_RDWR | O_NONBLOCK);
        if(fd < 0){
            info.error = strerror(errno);
            out.push_back(info);
            continue;
        }
        info.opened = true;
        v4l2_capability cap{};
        if(ioctl(fd, VIDIOC_QUERYCAP, &cap) == 0){
            info.querycap_ok = true;
            info.driver = reinterpret_cast<const char*>(cap.driver);
            info.card = reinterpret_cast<const char*>(cap.card);
            info.bus_info = reinterpret_cast<const char*>(cap.bus_info);
            info.capabilities = cap.capabilities;

            v4l2_fmtdesc fmt{};
            fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            for(fmt.index = 0; ioctl(fd, VIDIOC_ENUM_FMT, &fmt) == 0; fmt.index++){
                v4l2_frmsizeenum sz{};
                sz.pixel_format = fmt.pixelformat;
                for(sz.index = 0; ioctl(fd, VIDIOC_ENUM_FRAMESIZES, &sz) == 0; sz.index++){
                    if(sz.type == V4L2_FRMSIZE_TYPE_DISCRETE){
                        VideoFormatInfo vf{};
                        vf.fourcc = fmt.pixelformat;
                        vf.width = (int)sz.discrete.width;
                        vf.height = (int)sz.discrete.height;

                        v4l2_frmivalenum iv{};
                        iv.pixel_format = fmt.pixelformat;
                        iv.width = sz.discrete.width;
                        iv.height = sz.discrete.height;
                        iv.index = 0;
                        if(ioctl(fd, VIDIOC_ENUM_FRAMEINTERVALS, &iv) == 0 && iv.type == V4L2_FRMIVAL_TYPE_DISCRETE){
                            vf.fps_num = iv.discrete.denominator;
                            vf.fps_den = iv.discrete.numerator;
                        }
                        info.formats.push_back(vf);
                    }
                }
            }
        } else {
            info.error = strerror(errno);
        }
        close(fd);
        out.push_back(info);
    }
    closedir(d);
    std::sort(out.begin(), out.end(), [](const VideoDeviceInfo& a, const VideoDeviceInfo& b){ return a.path < b.path; });
    return out;
}

std::string device_info_to_json(const std::vector<VideoDeviceInfo>& list){
    std::ostringstream s;
    s << "{\"devices\":[";
    for(size_t i=0;i<list.size();++i){
        const auto& d = list[i];
        if(i) s << ",";
        s << "{\"path\":\"" << esc(d.path) << "\","
          << "\"opened\":" << (d.opened?"true":"false") << ","
          << "\"querycap\":" << (d.querycap_ok?"true":"false") << ","
          << "\"driver\":\"" << esc(d.driver) << "\","
          << "\"card\":\"" << esc(d.card) << "\","
          << "\"bus\":\"" << esc(d.bus_info) << "\","
          << "\"caps\":" << d.capabilities << ","
          << "\"error\":\"" << esc(d.error) << "\","
          << "\"formats\":[";
        for(size_t j=0;j<d.formats.size();++j){
            if(j) s << ",";
            const auto& f = d.formats[j];
            s << "{\"fourcc\":\"" << fourcc_to_string(f.fourcc) << "\","
              << "\"fourccInt\":" << f.fourcc << ","
              << "\"w\":" << f.width << ","
              << "\"h\":" << f.height << ","
              << "\"fpsNum\":" << f.fps_num << ","
              << "\"fpsDen\":" << f.fps_den << "}";
        }
        s << "]}";
    }
    s << "]}";
    return s.str();
}

bool capture_one_frame(const std::string& dev,
                       int reqWidth,
                       int reqHeight,
                       unsigned int reqFourcc,
                       std::vector<unsigned char>& out,
                       int& actualWidth,
                       int& actualHeight,
                       unsigned int& actualFourcc,
                       std::string& error){
    int fd = open(dev.c_str(), O_RDWR);
    if(fd < 0){ error = strerror(errno); return false; }

    v4l2_format format{};
    format.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    format.fmt.pix.width = reqWidth;
    format.fmt.pix.height = reqHeight;
    format.fmt.pix.pixelformat = reqFourcc;
    format.fmt.pix.field = V4L2_FIELD_ANY;
    if(ioctl(fd, VIDIOC_S_FMT, &format) < 0){
        error = std::string("VIDIOC_S_FMT: ") + strerror(errno);
        close(fd);
        return false;
    }
    actualWidth = (int)format.fmt.pix.width;
    actualHeight = (int)format.fmt.pix.height;
    actualFourcc = format.fmt.pix.pixelformat;

    v4l2_requestbuffers req{};
    req.count = 4;
    req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    req.memory = V4L2_MEMORY_MMAP;
    if(ioctl(fd, VIDIOC_REQBUFS, &req) < 0 || req.count == 0){
        error = std::string("VIDIOC_REQBUFS: ") + strerror(errno);
        close(fd); return false;
    }

    struct Buf { void* ptr=nullptr; size_t len=0; };
    std::vector<Buf> bufs(req.count);

    for(unsigned int i=0;i<req.count;++i){
        v4l2_buffer b{};
        b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
        b.memory = V4L2_MEMORY_MMAP;
        b.index = i;
        if(ioctl(fd, VIDIOC_QUERYBUF, &b) < 0){
            error = std::string("VIDIOC_QUERYBUF: ") + strerror(errno);
            close(fd); return false;
        }
        void* p = mmap(nullptr, b.length, PROT_READ|PROT_WRITE, MAP_SHARED, fd, b.m.offset);
        if(p == MAP_FAILED){
            error = std::string("mmap: ") + strerror(errno);
            close(fd); return false;
        }
        bufs[i].ptr = p; bufs[i].len = b.length;
        if(ioctl(fd, VIDIOC_QBUF, &b) < 0){
            error = std::string("VIDIOC_QBUF: ") + strerror(errno);
            close(fd); return false;
        }
    }

    v4l2_buf_type type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    if(ioctl(fd, VIDIOC_STREAMON, &type) < 0){
        error = std::string("VIDIOC_STREAMON: ") + strerror(errno);
        close(fd); return false;
    }

    fd_set fds;
    FD_ZERO(&fds); FD_SET(fd,&fds);
    timeval tv{}; tv.tv_sec = 3;
    int sr = select(fd+1,&fds,nullptr,nullptr,&tv);
    if(sr <= 0){
        error = sr==0 ? "frame timeout" : strerror(errno);
        ioctl(fd, VIDIOC_STREAMOFF, &type);
        for(auto& b:bufs) if(b.ptr) munmap(b.ptr,b.len);
        close(fd); return false;
    }

    v4l2_buffer b{};
    b.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    b.memory = V4L2_MEMORY_MMAP;
    if(ioctl(fd, VIDIOC_DQBUF, &b) < 0){
        error = std::string("VIDIOC_DQBUF: ") + strerror(errno);
        ioctl(fd, VIDIOC_STREAMOFF, &type);
        for(auto& q:bufs) if(q.ptr) munmap(q.ptr,q.len);
        close(fd); return false;
    }

    out.assign((unsigned char*)bufs[b.index].ptr, (unsigned char*)bufs[b.index].ptr + b.bytesused);

    ioctl(fd, VIDIOC_STREAMOFF, &type);
    for(auto& q:bufs) if(q.ptr) munmap(q.ptr,q.len);
    close(fd);
    return true;
}
