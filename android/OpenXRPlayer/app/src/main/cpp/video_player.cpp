#include "video_player.h"
#include <GLES2/gl2ext.h>
#include <android/log.h>

#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR,"OpenXRVideo",__VA_ARGS__)

namespace {
void clearException(JNIEnv* env){
    if(env && env->ExceptionCheck()){
        env->ExceptionDescribe();
        env->ExceptionClear();
    }
}
}

bool AndroidVideoPlayer::open(JNIEnv* env,const std::string& path,bool loop){
    close(env);
    if(!env || path.empty()) return false;

    glGenTextures(1,&texture_);
    glBindTexture(GL_TEXTURE_EXTERNAL_OES,texture_);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES,GL_TEXTURE_MIN_FILTER,GL_LINEAR);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_EXTERNAL_OES,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
    glBindTexture(GL_TEXTURE_EXTERNAL_OES,0);

    jclass stClass=env->FindClass("android/graphics/SurfaceTexture");
    if(!stClass){ clearException(env); close(env); return false; }
    jmethodID stCtor=env->GetMethodID(stClass,"<init>","(I)V");
    jobject stLocal=stCtor ? env->NewObject(stClass,stCtor,(jint)texture_) : nullptr;
    if(!stLocal){ clearException(env); env->DeleteLocalRef(stClass); close(env); return false; }

    jclass surfaceClass=env->FindClass("android/view/Surface");
    jmethodID surfaceCtor=surfaceClass
        ? env->GetMethodID(surfaceClass,"<init>","(Landroid/graphics/SurfaceTexture;)V")
        : nullptr;
    jobject surfaceLocal=surfaceCtor ? env->NewObject(surfaceClass,surfaceCtor,stLocal) : nullptr;
    if(!surfaceLocal){
        clearException(env);
        env->DeleteLocalRef(stLocal);
        env->DeleteLocalRef(stClass);
        if(surfaceClass) env->DeleteLocalRef(surfaceClass);
        close(env);
        return false;
    }

    jclass mpClass=env->FindClass("android/media/MediaPlayer");
    jmethodID mpCtor=mpClass ? env->GetMethodID(mpClass,"<init>","()V") : nullptr;
    jobject mpLocal=mpCtor ? env->NewObject(mpClass,mpCtor) : nullptr;
    if(!mpLocal){
        clearException(env);
        env->DeleteLocalRef(surfaceLocal);
        env->DeleteLocalRef(stLocal);
        env->DeleteLocalRef(stClass);
        env->DeleteLocalRef(surfaceClass);
        if(mpClass) env->DeleteLocalRef(mpClass);
        close(env);
        return false;
    }

    jmethodID setData=env->GetMethodID(mpClass,"setDataSource","(Ljava/lang/String;)V");
    jmethodID setSurface=env->GetMethodID(mpClass,"setSurface","(Landroid/view/Surface;)V");
    jmethodID setLoop=env->GetMethodID(mpClass,"setLooping","(Z)V");
    jmethodID prepare=env->GetMethodID(mpClass,"prepare","()V");
    jmethodID start=env->GetMethodID(mpClass,"start","()V");

    jstring jpath=env->NewStringUTF(path.c_str());
    env->CallVoidMethod(mpLocal,setData,jpath);
    env->DeleteLocalRef(jpath);
    env->CallVoidMethod(mpLocal,setSurface,surfaceLocal);
    env->CallVoidMethod(mpLocal,setLoop,loop?JNI_TRUE:JNI_FALSE);

    // Prefer Android's system spatializer for media when the platform API supports it.
    jclass aaBuilderClass=env->FindClass("android/media/AudioAttributes$Builder");
    if(aaBuilderClass){
        jmethodID aaCtor=env->GetMethodID(aaBuilderClass,"<init>","()V");
        jobject builder=aaCtor ? env->NewObject(aaBuilderClass,aaCtor) : nullptr;
        if(builder){
            jmethodID setUsage=env->GetMethodID(
                aaBuilderClass,"setUsage",
                "(I)Landroid/media/AudioAttributes$Builder;"
            );
            jmethodID setContent=env->GetMethodID(
                aaBuilderClass,"setContentType",
                "(I)Landroid/media/AudioAttributes$Builder;"
            );
            if(setUsage) env->CallObjectMethod(builder,setUsage,1); // USAGE_MEDIA
            if(setContent) env->CallObjectMethod(builder,setContent,3); // CONTENT_TYPE_MOVIE

            jmethodID setSpatial=env->GetMethodID(
                aaBuilderClass,"setSpatializationBehavior",
                "(I)Landroid/media/AudioAttributes$Builder;"
            );
            if(setSpatial) env->CallObjectMethod(builder,setSpatial,0); // AUTO
            else clearException(env);

            jmethodID build=env->GetMethodID(
                aaBuilderClass,"build","()Landroid/media/AudioAttributes;"
            );
            jobject attrs=build ? env->CallObjectMethod(builder,build) : nullptr;
            if(attrs){
                jmethodID setAttrs=env->GetMethodID(
                    mpClass,"setAudioAttributes","(Landroid/media/AudioAttributes;)V"
                );
                if(setAttrs) env->CallVoidMethod(mpLocal,setAttrs,attrs);
                else clearException(env);
                env->DeleteLocalRef(attrs);
            }
            env->DeleteLocalRef(builder);
        }
        env->DeleteLocalRef(aaBuilderClass);
    } else {
        clearException(env);
    }

    if(env->ExceptionCheck()){
        clearException(env);
        env->DeleteLocalRef(mpLocal);
        env->DeleteLocalRef(surfaceLocal);
        env->DeleteLocalRef(stLocal);
        env->DeleteLocalRef(stClass);
        env->DeleteLocalRef(surfaceClass);
        env->DeleteLocalRef(mpClass);
        close(env);
        return false;
    }

    env->CallVoidMethod(mpLocal,prepare);
    if(env->ExceptionCheck()){
        clearException(env);
        env->DeleteLocalRef(mpLocal);
        env->DeleteLocalRef(surfaceLocal);
        env->DeleteLocalRef(stLocal);
        env->DeleteLocalRef(stClass);
        env->DeleteLocalRef(surfaceClass);
        env->DeleteLocalRef(mpClass);
        close(env);
        return false;
    }

    env->CallVoidMethod(mpLocal,start);
    if(env->ExceptionCheck()){
        clearException(env);
        env->DeleteLocalRef(mpLocal);
        env->DeleteLocalRef(surfaceLocal);
        env->DeleteLocalRef(stLocal);
        env->DeleteLocalRef(stClass);
        env->DeleteLocalRef(surfaceClass);
        env->DeleteLocalRef(mpClass);
        close(env);
        return false;
    }

    surfaceTexture_=env->NewGlobalRef(stLocal);
    surface_=env->NewGlobalRef(surfaceLocal);
    mediaPlayer_=env->NewGlobalRef(mpLocal);

    env->DeleteLocalRef(mpLocal);
    env->DeleteLocalRef(surfaceLocal);
    env->DeleteLocalRef(stLocal);
    env->DeleteLocalRef(stClass);
    env->DeleteLocalRef(surfaceClass);
    env->DeleteLocalRef(mpClass);
    return true;
}

void AndroidVideoPlayer::update(JNIEnv* env){
    if(!env || !surfaceTexture_) return;
    jclass cls=env->GetObjectClass(surfaceTexture_);
    if(!cls) return;
    jmethodID update=env->GetMethodID(cls,"updateTexImage","()V");
    if(update) env->CallVoidMethod(surfaceTexture_,update);
    clearException(env);
    env->DeleteLocalRef(cls);
}

void AndroidVideoPlayer::close(JNIEnv* env){
    if(env && mediaPlayer_){
        jclass cls=env->GetObjectClass(mediaPlayer_);
        if(cls){
            jmethodID stop=env->GetMethodID(cls,"stop","()V");
            jmethodID release=env->GetMethodID(cls,"release","()V");
            if(stop) env->CallVoidMethod(mediaPlayer_,stop);
            clearException(env);
            if(release) env->CallVoidMethod(mediaPlayer_,release);
            clearException(env);
            env->DeleteLocalRef(cls);
        }
        env->DeleteGlobalRef(mediaPlayer_);
    }
    if(env && surface_){
        jclass cls=env->GetObjectClass(surface_);
        if(cls){
            jmethodID release=env->GetMethodID(cls,"release","()V");
            if(release) env->CallVoidMethod(surface_,release);
            clearException(env);
            env->DeleteLocalRef(cls);
        }
        env->DeleteGlobalRef(surface_);
    }
    if(env && surfaceTexture_){
        jclass cls=env->GetObjectClass(surfaceTexture_);
        if(cls){
            jmethodID release=env->GetMethodID(cls,"release","()V");
            if(release) env->CallVoidMethod(surfaceTexture_,release);
            clearException(env);
            env->DeleteLocalRef(cls);
        }
        env->DeleteGlobalRef(surfaceTexture_);
    }

    mediaPlayer_=nullptr;
    surface_=nullptr;
    surfaceTexture_=nullptr;

    if(texture_){
        glDeleteTextures(1,&texture_);
        texture_=0;
    }
}
