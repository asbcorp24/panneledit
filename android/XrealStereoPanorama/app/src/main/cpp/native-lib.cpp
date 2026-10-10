#include <jni.h>
#include <string>
#include <vector>
#include <linux/videodev2.h>
#include "v4l2_probe.h"

extern "C" JNIEXPORT jstring JNICALL
Java_ru_asbcorp_xrealstereo_NativeV4L2_probeJson(JNIEnv* env, jclass) {
    auto list = probe_video_devices();
    std::string json = device_info_to_json(list);
    return env->NewStringUTF(json.c_str());
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_ru_asbcorp_xrealstereo_NativeV4L2_captureFrame(JNIEnv* env, jclass,
                                                    jstring jdev,
                                                    jint width,
                                                    jint height,
                                                    jint fourcc) {
    const char* dev = env->GetStringUTFChars(jdev, nullptr);
    std::vector<unsigned char> data;
    int aw=0,ah=0; unsigned int af=0; std::string err;
    bool ok = capture_one_frame(dev, width, height, (unsigned int)fourcc, data, aw, ah, af, err);
    env->ReleaseStringUTFChars(jdev, dev);
    if(!ok) return nullptr;
    jbyteArray arr = env->NewByteArray((jsize)data.size());
    env->SetByteArrayRegion(arr, 0, (jsize)data.size(), reinterpret_cast<const jbyte*>(data.data()));
    return arr;
}


#include <dlfcn.h>
#include <sstream>
#include <vector>

static std::string probe_nr_api_impl(bool tryCreate) {
    std::ostringstream s;
    const char* candidates[] = {
        "libnr_api.so",
        "/system/lib64/libnr_api.so",
        "/system_ext/lib64/libnr_api.so",
        "/vendor/lib64/libnr_api.so",
        "/product/lib64/libnr_api.so",
        "/system/lib/libnr_api.so",
        "/system_ext/lib/libnr_api.so",
        "/vendor/lib/libnr_api.so",
        "/product/lib/libnr_api.so"
    };

    void* handle = nullptr;
    std::string loadedFrom;
    std::vector<std::string> errors;
    for (const char* p : candidates) {
        dlerror();
        handle = dlopen(p, RTLD_NOW | RTLD_LOCAL);
        if (handle) {
            loadedFrom = p;
            break;
        }
        const char* e = dlerror();
        if (e) errors.push_back(std::string(p) + ": " + e);
    }

    s << "{";
    s << "\"loaded\":" << (handle ? "true":"false");
    s << ",\"loadedFrom\":\"" << loadedFrom << "\"";

    if (!handle) {
        s << ",\"errors\":[";
        for (size_t i=0;i<errors.size();++i) {
            if (i) s << ",";
            std::string e = errors[i];
            for (size_t p=0;(p=e.find("\\",p))!=std::string::npos;p+=2) e.replace(p,1,"\\\\");
            for (size_t p=0;(p=e.find("\"",p))!=std::string::npos;p+=2) e.replace(p,1,"\\\"");
            s << "\"" << e << "\"";
        }
        s << "]}";
        return s.str();
    }

    const char* names[] = {
        "NRRGBCameraCreate",
        "NRRGBCameraDestroy",
        "NRRGBCameraSetCaptureCallback",
        "NRRGBCameraSetImageFormat",
        "NRRGBCameraStartCapture",
        "NRRGBCameraStopCapture",
        "NRRGBCameraImageGetRawData",
        "NRRGBCameraImageGetResolution",
        "NRRGBCameraImageGetHMDTimeNanos",
        "NRRGBCameraImageDestroy",
        "NRGetVersion"
    };

    s << ",\"symbols\":{";
    for (size_t i=0;i<sizeof(names)/sizeof(names[0]);++i) {
        void* sym = dlsym(handle, names[i]);
        if (i) s << ",";
        s << "\"" << names[i] << "\":" << (sym ? "true":"false");
    }
    s << "}";

    if (tryCreate) {
        using CreateFn = int(*)(unsigned long long*);
        using DestroyFn = int(*)(unsigned long long);
        auto createFn = reinterpret_cast<CreateFn>(dlsym(handle, "NRRGBCameraCreate"));
        auto destroyFn = reinterpret_cast<DestroyFn>(dlsym(handle, "NRRGBCameraDestroy"));
        s << ",\"createAttempted\":" << (createFn ? "true":"false");
        if (createFn) {
            unsigned long long cam = 0;
            int result = createFn(&cam);
            s << ",\"createResult\":" << result;
            s << ",\"cameraHandle\":" << cam;
            if (result == 0 && cam != 0 && destroyFn) {
                int dr = destroyFn(cam);
                s << ",\"destroyResult\":" << dr;
            }
        }
    }

    dlclose(handle);
    s << "}";
    return s.str();
}

extern "C" JNIEXPORT jstring JNICALL
Java_ru_asbcorp_xrealstereo_NativeV4L2_probeNrApi(JNIEnv* env, jclass, jboolean tryCreate) {
    std::string json = probe_nr_api_impl(tryCreate == JNI_TRUE);
    return env->NewStringUTF(json.c_str());
}
