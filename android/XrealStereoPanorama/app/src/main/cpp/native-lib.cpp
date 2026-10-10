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
