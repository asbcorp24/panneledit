#pragma once
#include <GLES3/gl3.h>
#include <jni.h>
#include <string>

class AndroidVideoPlayer {
public:
    bool open(JNIEnv* env, const std::string& path, bool loop=true);
    void update(JNIEnv* env);
    void close(JNIEnv* env);
    GLuint texture() const { return texture_; }
    bool valid() const { return texture_ != 0 && mediaPlayer_ != nullptr; }

private:
    GLuint texture_ = 0;
    jobject surfaceTexture_ = nullptr;
    jobject surface_ = nullptr;
    jobject mediaPlayer_ = nullptr;
};
