#include <android/log.h>
#include <android/bitmap.h>
#include <android_native_app_glue.h>

#include <EGL/egl.h>
#include <GLES3/gl3.h>

#define XR_USE_PLATFORM_ANDROID
#define XR_USE_GRAPHICS_API_OPENGL_ES
#include <openxr/openxr.h>
#include <openxr/openxr_platform.h>

#include <jni.h>

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
#include "stl_mesh.h"
#include "video_player.h"
#include <GLES2/gl2ext.h>

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "OpenXRPlayer", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "OpenXRPlayer", __VA_ARGS__)

namespace {

constexpr float kPi = 3.14159265358979323846f;
constexpr float kDeg = kPi / 180.0f;

struct Mat4 {
    float m[16]{};
};

Mat4 identity() {
    Mat4 r{};
    r.m[0] = r.m[5] = r.m[10] = r.m[15] = 1.0f;
    return r;
}

Mat4 multiply(const Mat4& a, const Mat4& b) {
    Mat4 r{};
    for (int col = 0; col < 4; ++col) {
        for (int row = 0; row < 4; ++row) {
            float v = 0.0f;
            for (int k = 0; k < 4; ++k) {
                v += a.m[k * 4 + row] * b.m[col * 4 + k];
            }
            r.m[col * 4 + row] = v;
        }
    }
    return r;
}
Mat4 translation(float x,float y,float z){
    Mat4 m=identity(); m.m[12]=x; m.m[13]=y; m.m[14]=z; return m;
}
Mat4 scaleMatrix(float x,float y,float z){
    Mat4 m{}; m.m[0]=x; m.m[5]=y; m.m[10]=z; m.m[15]=1; return m;
}
Mat4 rotationX(float a){
    Mat4 m=identity(); float c=std::cos(a),s=std::sin(a);
    m.m[5]=c; m.m[9]=-s; m.m[6]=s; m.m[10]=c; return m;
}
Mat4 rotationY(float a){
    Mat4 m=identity(); float c=std::cos(a),s=std::sin(a);
    m.m[0]=c; m.m[8]=s; m.m[2]=-s; m.m[10]=c; return m;
}

Mat4 projectionFromFov(const XrFovf& fov, float nearZ = 0.05f, float farZ = 100.0f) {
    const float l = std::tan(fov.angleLeft);
    const float r = std::tan(fov.angleRight);
    const float d = std::tan(fov.angleDown);
    const float u = std::tan(fov.angleUp);
    const float w = r - l;
    const float h = u - d;

    Mat4 m{};
    m.m[0] = 2.0f / w;
    m.m[5] = 2.0f / h;
    m.m[8] = (r + l) / w;
    m.m[9] = (u + d) / h;
    m.m[10] = -(farZ + nearZ) / (farZ - nearZ);
    m.m[11] = -1.0f;
    m.m[14] = -(2.0f * farZ * nearZ) / (farZ - nearZ);
    return m;
}

Mat4 viewFromPose(const XrPosef& pose) {
    const float x = pose.orientation.x;
    const float y = pose.orientation.y;
    const float z = pose.orientation.z;
    const float w = pose.orientation.w;

    const float r00 = 1 - 2 * y * y - 2 * z * z;
    const float r01 = 2 * x * y - 2 * z * w;
    const float r02 = 2 * x * z + 2 * y * w;
    const float r10 = 2 * x * y + 2 * z * w;
    const float r11 = 1 - 2 * x * x - 2 * z * z;
    const float r12 = 2 * y * z - 2 * x * w;
    const float r20 = 2 * x * z - 2 * y * w;
    const float r21 = 2 * y * z + 2 * x * w;
    const float r22 = 1 - 2 * x * x - 2 * y * y;

    // Inverse rigid transform: R^T and -R^T t.
    Mat4 m = identity();
    m.m[0] = r00; m.m[4] = r10; m.m[8]  = r20;
    m.m[1] = r01; m.m[5] = r11; m.m[9]  = r21;
    m.m[2] = r02; m.m[6] = r12; m.m[10] = r22;

    const float px = pose.position.x;
    const float py = pose.position.y;
    const float pz = pose.position.z;
    m.m[12] = -(r00 * px + r10 * py + r20 * pz);
    m.m[13] = -(r01 * px + r11 * py + r21 * pz);
    m.m[14] = -(r02 * px + r12 * py + r22 * pz);
    return m;
}

struct EglState {
    EGLDisplay display = EGL_NO_DISPLAY;
    EGLConfig config = nullptr;
    EGLContext context = EGL_NO_CONTEXT;
    EGLSurface surface = EGL_NO_SURFACE;

    bool create() {
        display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
        if (display == EGL_NO_DISPLAY) return false;

        EGLint major = 0, minor = 0;
        if (!eglInitialize(display, &major, &minor)) return false;
        if (!eglBindAPI(EGL_OPENGL_ES_API)) return false;

        const EGLint attrs[] = {
            EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
            EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
            EGL_RED_SIZE, 8,
            EGL_GREEN_SIZE, 8,
            EGL_BLUE_SIZE, 8,
            EGL_ALPHA_SIZE, 8,
            EGL_DEPTH_SIZE, 24,
            EGL_NONE
        };

        EGLint count = 0;
        if (!eglChooseConfig(display, attrs, &config, 1, &count) || count < 1) return false;

        const EGLint ctxAttrs[] = {
            EGL_CONTEXT_CLIENT_VERSION, 3,
            EGL_NONE
        };
        context = eglCreateContext(display, config, EGL_NO_CONTEXT, ctxAttrs);
        if (context == EGL_NO_CONTEXT) return false;

        const EGLint pbufferAttrs[] = {
            EGL_WIDTH, 16,
            EGL_HEIGHT, 16,
            EGL_NONE
        };
        surface = eglCreatePbufferSurface(display, config, pbufferAttrs);
        if (surface == EGL_NO_SURFACE) return false;

        return eglMakeCurrent(display, surface, surface, context) == EGL_TRUE;
    }

    void destroy() {
        if (display != EGL_NO_DISPLAY) {
            eglMakeCurrent(display, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
            if (surface != EGL_NO_SURFACE) eglDestroySurface(display, surface);
            if (context != EGL_NO_CONTEXT) eglDestroyContext(display, context);
            eglTerminate(display);
        }
        display = EGL_NO_DISPLAY;
        surface = EGL_NO_SURFACE;
        context = EGL_NO_CONTEXT;
        config = nullptr;
    }
};

struct JniBridge {
    android_app* app = nullptr;
    JNIEnv* env = nullptr;
    bool attached = false;
    jclass activityClass = nullptr;

    explicit JniBridge(android_app* a) : app(a) {
        if (!app || !app->activity || !app->activity->vm) return;
        JavaVM* vm = app->activity->vm;
        if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
            if (vm->AttachCurrentThread(&env, nullptr) == JNI_OK) attached = true;
        }
        if (env && app->activity->clazz) {
            activityClass = static_cast<jclass>(env->NewGlobalRef(env->GetObjectClass(app->activity->clazz)));
        }
    }

    ~JniBridge() {
        if (env && activityClass) env->DeleteGlobalRef(activityClass);
        if (attached && app && app->activity && app->activity->vm) {
            app->activity->vm->DetachCurrentThread();
        }
    }

    std::string callString(const char* name) const {
        if (!env || !activityClass) return {};
        jmethodID mid = env->GetMethodID(activityClass, name, "()Ljava/lang/String;");
        if (!mid) { env->ExceptionClear(); return {}; }
        jstring s = static_cast<jstring>(env->CallObjectMethod(app->activity->clazz, mid));
        if (env->ExceptionCheck()) { env->ExceptionClear(); return {}; }
        if (!s) return {};
        const char* chars = env->GetStringUTFChars(s, nullptr);
        std::string out = chars ? chars : "";
        if (chars) env->ReleaseStringUTFChars(s, chars);
        env->DeleteLocalRef(s);
        return out;
    }

    int callInt(const char* name) const {
        if (!env || !activityClass) return 0;
        jmethodID mid = env->GetMethodID(activityClass, name, "()I");
        if (!mid) { env->ExceptionClear(); return 0; }
        jint v = env->CallIntMethod(app->activity->clazz, mid);
        if (env->ExceptionCheck()) { env->ExceptionClear(); return 0; }
        return static_cast<int>(v);
    }
    bool callBool(const char* name) const {
        if (!env || !activityClass) return false;
        jmethodID mid = env->GetMethodID(activityClass, name, "()Z");
        if (!mid) { env->ExceptionClear(); return false; }
        jboolean v = env->CallBooleanMethod(app->activity->clazz, mid);
        if (env->ExceptionCheck()) { env->ExceptionClear(); return false; }
        return v == JNI_TRUE;
    }


    float callFloat(const char* name) const {
        if (!env || !activityClass) return 0.0f;
        jmethodID mid = env->GetMethodID(activityClass, name, "()F");
        if (!mid) { env->ExceptionClear(); return 0.0f; }
        jfloat v = env->CallFloatMethod(app->activity->clazz, mid);
        if (env->ExceptionCheck()) { env->ExceptionClear(); return 0.0f; }
        return v;
    }

    bool activateHotspot(const std::string& id) const {
        if (!env || !activityClass) return false;
        jmethodID mid = env->GetMethodID(activityClass, "nativeActivateHotspot", "(Ljava/lang/String;)Z");
        if (!mid) { env->ExceptionClear(); return false; }
        jstring sid = env->NewStringUTF(id.c_str());
        jboolean result = env->CallBooleanMethod(app->activity->clazz, mid, sid);
        env->DeleteLocalRef(sid);
        if (env->ExceptionCheck()) { env->ExceptionClear(); return false; }
        return result == JNI_TRUE;
    }

    void toast(const std::string& text) const {
        if (!env || !activityClass) return;
        jmethodID mid = env->GetMethodID(activityClass, "nativeToast", "(Ljava/lang/String;)V");
        if (!mid) { env->ExceptionClear(); return; }
        jstring msg = env->NewStringUTF(text.c_str());
        env->CallVoidMethod(app->activity->clazz, mid, msg);
        env->DeleteLocalRef(msg);
        if (env->ExceptionCheck()) env->ExceptionClear();
    }

    GLuint loadTexture(const std::string& path, int* outW = nullptr, int* outH = nullptr) const {
        if (!env || path.empty()) return 0;

        jclass bitmapFactory = env->FindClass("android/graphics/BitmapFactory");
        if (!bitmapFactory) { env->ExceptionClear(); return 0; }
        jmethodID decodeFile = env->GetStaticMethodID(
            bitmapFactory,
            "decodeFile",
            "(Ljava/lang/String;)Landroid/graphics/Bitmap;"
        );
        if (!decodeFile) {
            env->ExceptionClear();
            env->DeleteLocalRef(bitmapFactory);
            return 0;
        }

        jstring jpath = env->NewStringUTF(path.c_str());
        jobject bitmap = env->CallStaticObjectMethod(bitmapFactory, decodeFile, jpath);
        env->DeleteLocalRef(jpath);
        env->DeleteLocalRef(bitmapFactory);

        if (env->ExceptionCheck()) {
            env->ExceptionClear();
            return 0;
        }
        if (!bitmap) return 0;

        AndroidBitmapInfo info{};
        if (AndroidBitmap_getInfo(env, bitmap, &info) != ANDROID_BITMAP_RESULT_SUCCESS ||
            info.format != ANDROID_BITMAP_FORMAT_RGBA_8888) {
            env->DeleteLocalRef(bitmap);
            return 0;
        }

        void* pixels = nullptr;
        if (AndroidBitmap_lockPixels(env, bitmap, &pixels) != ANDROID_BITMAP_RESULT_SUCCESS || !pixels) {
            env->DeleteLocalRef(bitmap);
            return 0;
        }

        GLuint texture = 0;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RGBA8,
            static_cast<GLsizei>(info.width),
            static_cast<GLsizei>(info.height),
            0,
            GL_RGBA,
            GL_UNSIGNED_BYTE,
            pixels
        );
        glBindTexture(GL_TEXTURE_2D, 0);

        AndroidBitmap_unlockPixels(env, bitmap);
        env->DeleteLocalRef(bitmap);

        if (outW) *outW = static_cast<int>(info.width);
        if (outH) *outH = static_cast<int>(info.height);
        return texture;
    }
};

struct Hotspot {
    std::string id;
    std::string type;
    std::string target;
    float yaw = 0;
    float pitch = 0;
};

struct ObjectFrameRef {
    int row=0;
    int sector=0;
    std::string path;
};

std::vector<ObjectFrameRef> parseObjectFrames(const std::string& packed) {
    std::vector<ObjectFrameRef> out;
    std::istringstream lines(packed);
    std::string line;
    while (std::getline(lines,line)) {
        if(line.empty()) continue;
        std::vector<std::string> f;
        std::stringstream ss(line);
        std::string field;
        while(std::getline(ss,field,'\t')) f.push_back(field);
        if(f.size()<3) continue;
        try {
            ObjectFrameRef r;
            r.row=std::stoi(f[0]);
            r.sector=std::stoi(f[1]);
            r.path=f[2];
            out.push_back(std::move(r));
        } catch (...) {}
    }
    return out;
}

std::vector<Hotspot> parseHotspots(const std::string& packed) {
    std::vector<Hotspot> out;
    std::istringstream lines(packed);
    std::string line;
    while (std::getline(lines, line)) {
        if (line.empty()) continue;
        std::vector<std::string> fields;
        std::stringstream ss(line);
        std::string field;
        while (std::getline(ss, field, '\t')) fields.push_back(field);
        if (fields.size() < 5) continue;
        Hotspot h;
        h.id = fields[0];
        h.type = fields[1];
        h.target = fields[2];
        try {
            h.yaw = std::stof(fields[3]);
            h.pitch = std::stof(fields[4]);
        } catch (...) {
            continue;
        }
        out.push_back(std::move(h));
    }
    return out;
}

float wrapAngle(float deg) {
    while (deg > 180.0f) deg -= 360.0f;
    while (deg < -180.0f) deg += 360.0f;
    return deg;
}

void poseForwardYawPitch(const XrPosef& pose, float& yawDeg, float& pitchDeg) {
    const float x = pose.orientation.x;
    const float y = pose.orientation.y;
    const float z = pose.orientation.z;
    const float w = pose.orientation.w;

    // Rotate forward vector (0,0,-1) by quaternion.
    const float fx = -2.0f * (x * z + w * y);
    const float fy = -2.0f * (y * z - w * x);
    const float fz = -(1.0f - 2.0f * (x * x + y * y));

    yawDeg = std::atan2(fx, -fz) / kDeg;
    pitchDeg = std::asin(std::clamp(fy, -1.0f, 1.0f)) / kDeg;
}

GLuint compileShader(GLenum type, const char* src) {
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &src, nullptr);
    glCompileShader(shader);
    GLint ok = GL_FALSE;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[1024]{};
        glGetShaderInfoLog(shader, sizeof(log), nullptr, log);
        LOGE("shader: %s", log);
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

GLuint linkProgram(const char* vsSrc, const char* fsSrc) {
    GLuint vs = compileShader(GL_VERTEX_SHADER, vsSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
        if (vs) glDeleteShader(vs);
        if (fs) glDeleteShader(fs);
        return 0;
    }

    GLuint p = glCreateProgram();
    glAttachShader(p, vs);
    glAttachShader(p, fs);
    glLinkProgram(p);
    glDeleteShader(vs);
    glDeleteShader(fs);

    GLint ok = GL_FALSE;
    glGetProgramiv(p, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[1024]{};
        glGetProgramInfoLog(p, sizeof(log), nullptr, log);
        LOGE("program: %s", log);
        glDeleteProgram(p);
        return 0;
    }
    return p;
}

struct Renderer {
    GLuint program = 0;
    GLuint videoProgram = 0;
    GLuint reticleProgram = 0;
    GLuint stlProgram = 0;
    GLuint vao = 0;
    GLuint quadVao = 0;
    GLuint quadVbo = 0;
    GLuint quadIbo = 0;
    GLuint stlVao = 0;
    GLuint stlVbo = 0;
    GLsizei stlVertexCount = 0;

    struct TileMesh {
        GLuint texture=0;
        GLuint vao=0;
        GLuint vbo=0;
        bool detail=false;
        char face='f';
    };
    std::vector<TileMesh> multiresBase;
    std::vector<TileMesh> multiresDetail;

    GLuint vbo = 0;
    GLuint ibo = 0;
    GLsizei indexCount = 0;
    GLuint texture = 0;
    GLuint videoTexture = 0;
    GLuint fbo = 0;

    GLint uMvp = -1;
    GLint uUvScale = -1;
    GLint uUvOffset = -1;
    GLint uYawOffset = -1;

    std::string projection = "360";
    std::string mode = "panorama";
    float sceneYaw = 0.0f;
    float scenePitch = 0.0f;
    float objectAspect = 1.5f;
    float stlZoom = 1.0f;
    bool stlWireframe = false;
    float stlColor[3]{0.49f,0.55f,1.0f};

    bool init() {
        static const char* vs = R"(
            #version 300 es
            layout(location=0) in vec3 aPos;
            layout(location=1) in vec2 aUv;
            uniform mat4 uMvp;
            out vec2 vUv;
            void main() {
                vUv = aUv;
                gl_Position = uMvp * vec4(aPos,1.0);
            }
        )";

        static const char* fs = R"(
            #version 300 es
            precision mediump float;
            in vec2 vUv;
            uniform sampler2D uTex;
            uniform vec2 uUvScale;
            uniform vec2 uUvOffset;
            uniform float uYawOffset;
            uniform int uHalfSphere;
            out vec4 fragColor;
            void main() {
                float wrappedU = fract(vUv.x + uYawOffset);
                if (uHalfSphere == 1) {
                    float d = wrappedU - 0.5;
                    if (abs(d) > 0.25) discard;
                    wrappedU = (wrappedU - 0.25) * 2.0;
                }
                vec2 uv = vec2(wrappedU, vUv.y) * uUvScale + uUvOffset;
                fragColor = texture(uTex, uv);
            }
        )";

        static const char* videoFs = R"(
            #version 300 es
            #extension GL_OES_EGL_image_external_essl3 : require
            precision mediump float;
            in vec2 vUv;
            uniform samplerExternalOES uTex;
            uniform vec2 uUvScale;
            uniform vec2 uUvOffset;
            uniform float uYawOffset;
            uniform int uHalfSphere;
            out vec4 fragColor;
            void main() {
                float wrappedU = fract(vUv.x + uYawOffset);
                if (uHalfSphere == 1) {
                    float d = wrappedU - 0.5;
                    if (abs(d) > 0.25) discard;
                    wrappedU = (wrappedU - 0.25) * 2.0;
                }
                vec2 uv = vec2(wrappedU, vUv.y) * uUvScale + uUvOffset;
                fragColor = texture(uTex, uv);
            }
        )";

        static const char* retVs = R"(
            #version 300 es
            uniform mat4 uProjection;
            void main() {
                gl_Position = uProjection * vec4(0.0,0.0,-2.0,1.0);
                gl_PointSize = 12.0;
            }
        )";
        static const char* retFs = R"(
            #version 300 es
            precision mediump float;
            uniform vec4 uColor;
            out vec4 fragColor;
            void main() {
                vec2 p = gl_PointCoord - vec2(0.5);
                float d = length(p);
                if (d > 0.48 || d < 0.18) discard;
                fragColor = uColor;
            }
        )";

        static const char* stlVs = R"(
            #version 300 es
            layout(location=0) in vec3 aPos;
            layout(location=1) in vec3 aNormal;
            uniform mat4 uMvp;
            uniform mat4 uModel;
            out vec3 vNormal;
            void main() {
                vNormal = mat3(uModel) * aNormal;
                gl_Position = uMvp * vec4(aPos,1.0);
            }
        )";
        static const char* stlFs = R"(
            #version 300 es
            precision mediump float;
            in vec3 vNormal;
            uniform vec3 uColor;
            out vec4 fragColor;
            void main() {
                vec3 n = normalize(vNormal);
                float light = 0.28 + 0.72 * max(dot(n,normalize(vec3(0.35,0.7,0.6))),0.0);
                fragColor = vec4(uColor * light,1.0);
            }
        )";

        program = linkProgram(vs, fs);
        videoProgram = linkProgram(vs, videoFs);
        reticleProgram = linkProgram(retVs, retFs);
        stlProgram = linkProgram(stlVs, stlFs);
        if (!program || !videoProgram || !reticleProgram || !stlProgram) return false;

        uMvp = glGetUniformLocation(program, "uMvp");
        uUvScale = glGetUniformLocation(program, "uUvScale");
        uUvOffset = glGetUniformLocation(program, "uUvOffset");
        uYawOffset = glGetUniformLocation(program, "uYawOffset");

        buildSphere();
        buildQuad();
        glGenFramebuffers(1, &fbo);
        return vao != 0 && fbo != 0;
    }

    void buildSphere() {
        constexpr int lon = 72;
        constexpr int lat = 36;
        std::vector<float> vertices;
        std::vector<uint32_t> indices;

        vertices.reserve((lon + 1) * (lat + 1) * 5);
        for (int y = 0; y <= lat; ++y) {
            const float v = static_cast<float>(y) / lat;
            const float phi = -kPi * 0.5f + v * kPi;
            const float cp = std::cos(phi);
            const float sp = std::sin(phi);
            for (int x = 0; x <= lon; ++x) {
                const float u = static_cast<float>(x) / lon;
                const float theta = -kPi + u * 2.0f * kPi;
                const float sx = std::sin(theta) * cp;
                const float sy = sp;
                const float sz = -std::cos(theta) * cp;
                const float texV = 1.0f - v;
                vertices.insert(vertices.end(), {sx * 10.0f, sy * 10.0f, sz * 10.0f, u, texV});
            }
        }

        for (int y = 0; y < lat; ++y) {
            for (int x = 0; x < lon; ++x) {
                const uint32_t a = y * (lon + 1) + x;
                const uint32_t b = a + 1;
                const uint32_t c = a + lon + 1;
                const uint32_t d = c + 1;
                indices.insert(indices.end(), {a, c, b, b, c, d});
            }
        }

        indexCount = static_cast<GLsizei>(indices.size());

        glGenVertexArrays(1, &vao);
        glBindVertexArray(vao);

        glGenBuffers(1, &vbo);
        glBindBuffer(GL_ARRAY_BUFFER, vbo);
        glBufferData(
            GL_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(vertices.size() * sizeof(float)),
            vertices.data(),
            GL_STATIC_DRAW
        );

        glGenBuffers(1, &ibo);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ibo);
        glBufferData(
            GL_ELEMENT_ARRAY_BUFFER,
            static_cast<GLsizeiptr>(indices.size() * sizeof(uint32_t)),
            indices.data(),
            GL_STATIC_DRAW
        );

        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), nullptr);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), reinterpret_cast<void*>(3 * sizeof(float)));

        glBindVertexArray(0);
    }

    void buildQuad() {
        const float vertices[] = {
            -1.0f,-1.0f,0.0f, 0.0f,1.0f,
             1.0f,-1.0f,0.0f, 1.0f,1.0f,
             1.0f, 1.0f,0.0f, 1.0f,0.0f,
            -1.0f, 1.0f,0.0f, 0.0f,0.0f
        };
        const uint16_t indices[] = {0,1,2,0,2,3};
        glGenVertexArrays(1,&quadVao);
        glBindVertexArray(quadVao);
        glGenBuffers(1,&quadVbo);
        glBindBuffer(GL_ARRAY_BUFFER,quadVbo);
        glBufferData(GL_ARRAY_BUFFER,sizeof(vertices),vertices,GL_STATIC_DRAW);
        glGenBuffers(1,&quadIbo);
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,quadIbo);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER,sizeof(indices),indices,GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,5*sizeof(float),nullptr);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1,2,GL_FLOAT,GL_FALSE,5*sizeof(float),reinterpret_cast<void*>(3*sizeof(float)));
        glBindVertexArray(0);
    }

    void setMode(const std::string& value) { mode=value; }

    bool setStlMesh(const std::vector<StlVertex>& vertices,float zoom,bool wireframe,int rgb) {
        if (stlVbo) glDeleteBuffers(1,&stlVbo);
        if (stlVao) glDeleteVertexArrays(1,&stlVao);
        stlVao=stlVbo=0;
        stlVertexCount=0;
        if(vertices.empty()) return false;
        glGenVertexArrays(1,&stlVao);
        glBindVertexArray(stlVao);
        glGenBuffers(1,&stlVbo);
        glBindBuffer(GL_ARRAY_BUFFER,stlVbo);
        glBufferData(GL_ARRAY_BUFFER,vertices.size()*sizeof(StlVertex),vertices.data(),GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,sizeof(StlVertex),nullptr);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1,3,GL_FLOAT,GL_FALSE,sizeof(StlVertex),reinterpret_cast<void*>(3*sizeof(float)));
        glBindVertexArray(0);
        stlVertexCount=static_cast<GLsizei>(vertices.size());
        stlZoom=std::clamp(zoom,0.35f,5.0f);
        stlWireframe=wireframe;
        stlColor[0]=((rgb>>16)&255)/255.0f;
        stlColor[1]=((rgb>>8)&255)/255.0f;
        stlColor[2]=(rgb&255)/255.0f;
        return true;
    }

    void setObjectAspect(float aspect) {
        objectAspect=std::clamp(aspect,0.4f,3.0f);
    }

    std::array<float,3> facePoint(char face,float u,float v,float radius=10.0f) {
        const float sx=u*2.0f-1.0f;
        const float sy=1.0f-v*2.0f;
        float x=0,y=0,z=0;
        if(face=='f'){x=sx;y=sy;z=-1;}
        else if(face=='b'){x=-sx;y=sy;z=1;}
        else if(face=='u'){x=sx;y=1;z=sy;}
        else if(face=='d'){x=sx;y=-1;z=-sy;}
        else if(face=='l'){x=-1;y=sy;z=-sx;}
        else {x=1;y=sy;z=sx;}
        return {x*radius,y*radius,z*radius};
    }

    TileMesh makeMultiresTile(
        char face,float u0,float v0,float u1,float v1,GLuint tex,bool detail
    ){
        const auto p00=facePoint(face,u0,v0);
        const auto p10=facePoint(face,u1,v0);
        const auto p11=facePoint(face,u1,v1);
        const auto p01=facePoint(face,u0,v1);

        const float vertices[]={
            p00[0],p00[1],p00[2], 0,1,
            p10[0],p10[1],p10[2], 1,1,
            p11[0],p11[1],p11[2], 1,0,
            p00[0],p00[1],p00[2], 0,1,
            p11[0],p11[1],p11[2], 1,0,
            p01[0],p01[1],p01[2], 0,0
        };

        TileMesh mesh{};
        mesh.texture=tex;
        mesh.detail=detail;
        mesh.face=face;
        glGenVertexArrays(1,&mesh.vao);
        glBindVertexArray(mesh.vao);
        glGenBuffers(1,&mesh.vbo);
        glBindBuffer(GL_ARRAY_BUFFER,mesh.vbo);
        glBufferData(GL_ARRAY_BUFFER,sizeof(vertices),vertices,GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,5*sizeof(float),nullptr);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1,2,GL_FLOAT,GL_FALSE,5*sizeof(float),reinterpret_cast<void*>(3*sizeof(float)));
        glBindVertexArray(0);
        return mesh;
    }

    void clearTileMeshes(std::vector<TileMesh>& list){
        for(auto& tile:list){
            if(tile.texture) glDeleteTextures(1,&tile.texture);
            if(tile.vbo) glDeleteBuffers(1,&tile.vbo);
            if(tile.vao) glDeleteVertexArrays(1,&tile.vao);
        }
        list.clear();
    }

    void clearMultires(){
        clearTileMeshes(multiresBase);
        clearTileMeshes(multiresDetail);
    }

    void clearMultiresDetail(){
        clearTileMeshes(multiresDetail);
    }

    void addMultiresBase(char face,GLuint tex){
        if(!tex) return;
        multiresBase.push_back(makeMultiresTile(face,0,0,1,1,tex,false));
    }

    void addMultiresDetail(
        char face,int x,int y,int levelSize,int tileResolution,int tileW,int tileH,GLuint tex
    ){
        if(!tex || levelSize<=0) return;
        const float u0=(x*tileResolution)/static_cast<float>(levelSize);
        const float v0=(y*tileResolution)/static_cast<float>(levelSize);
        const float u1=std::min(1.0f,(x*tileResolution+tileW)/static_cast<float>(levelSize));
        const float v1=std::min(1.0f,(y*tileResolution+tileH)/static_cast<float>(levelSize));
        multiresDetail.push_back(makeMultiresTile(face,u0,v0,u1,v1,tex,true));
    }

    void renderMultires(const Mat4& projectionM,const Mat4& viewM){
        Mat4 model=multiply(
            rotationY(-sceneYaw*kDeg),
            rotationX(-scenePitch*kDeg)
        );
        Mat4 mvp=multiply(projectionM,multiply(viewM,model));
        glUseProgram(program);
        glUniformMatrix4fv(uMvp,1,GL_FALSE,mvp.m);
        glUniform2f(uUvScale,1,1);
        glUniform2f(uUvOffset,0,0);
        glUniform1f(uYawOffset,0);
        glUniform1i(glGetUniformLocation(program,"uHalfSphere"),0);
        glUniform1i(glGetUniformLocation(program,"uTex"),0);

        auto draw=[&](const std::vector<TileMesh>& list){
            for(const auto& tile:list){
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D,tile.texture);
                glBindVertexArray(tile.vao);
                glDrawArrays(GL_TRIANGLES,0,6);
            }
        };
        draw(multiresBase);
        draw(multiresDetail);
        glBindVertexArray(0);
        glBindTexture(GL_TEXTURE_2D,0);
    }

    void setSceneTexture(GLuint newTexture, std::string proj, float yaw, float pitch) {
        if (texture) glDeleteTextures(1, &texture);
        texture = newTexture;
        videoTexture = 0;
        projection = std::move(proj);
        sceneYaw = yaw;
        scenePitch = pitch;
    }

    void setVideoTexture(GLuint tex, std::string proj, float yaw, float pitch) {
        if (texture) {
            glDeleteTextures(1,&texture);
            texture=0;
        }
        videoTexture=tex;
        projection=std::move(proj);
        sceneYaw=yaw;
        scenePitch=pitch;
        mode="panorama";
    }

    void render(
        GLuint colorImage,
        int width,
        int height,
        const XrView& view,
        int eye,
        bool gazeTarget
    ) {
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, colorImage, 0);

        glViewport(0, 0, width, height);
        glDisable(GL_CULL_FACE);
        glDisable(GL_DEPTH_TEST);
        glClearColor(0.015f, 0.02f, 0.04f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);

        const Mat4 projectionM = projectionFromFov(view.fov);
        const Mat4 viewM = viewFromPose(view.pose);

        if (mode == "multires" && !multiresBase.empty()) {
            renderMultires(projectionM,viewM);
        } else if (mode == "stl" && stlVao && stlVertexCount > 0) {
            Mat4 model = multiply(
                translation(0.0f,-0.1f,-2.5f),
                multiply(
                    rotationY(sceneYaw * kDeg),
                    multiply(rotationX(scenePitch * kDeg),scaleMatrix(stlZoom,stlZoom,stlZoom))
                )
            );
            Mat4 mvp = multiply(projectionM,multiply(viewM,model));
            glEnable(GL_DEPTH_TEST);
            glUseProgram(stlProgram);
            glUniformMatrix4fv(glGetUniformLocation(stlProgram,"uMvp"),1,GL_FALSE,mvp.m);
            glUniformMatrix4fv(glGetUniformLocation(stlProgram,"uModel"),1,GL_FALSE,model.m);
            glUniform3fv(glGetUniformLocation(stlProgram,"uColor"),1,stlColor);
            glBindVertexArray(stlVao);
            glDrawArrays(stlWireframe ? GL_LINES : GL_TRIANGLES,0,stlVertexCount);
            glBindVertexArray(0);
            glDisable(GL_DEPTH_TEST);
        } else if (texture || videoTexture) {
            Mat4 model = identity();
            GLuint drawVao = vao;
            GLenum indexType = GL_UNSIGNED_INT;
            GLsizei drawCount = indexCount;

            if (mode == "object360") {
                const float sy = 0.95f;
                const float sx = sy * objectAspect;
                model = multiply(translation(0.0f,0.0f,-2.4f),scaleMatrix(sx,sy,1.0f));
                drawVao = quadVao;
                indexType = GL_UNSIGNED_SHORT;
                drawCount = 6;
            }

            const Mat4 mvp = multiply(projectionM,multiply(viewM,model));
            const bool video = videoTexture != 0;
            const GLuint activeProgram = video ? videoProgram : program;
            glUseProgram(activeProgram);
            glUniformMatrix4fv(glGetUniformLocation(activeProgram,"uMvp"), 1, GL_FALSE, mvp.m);

            float sx = 1.0f, sy = 1.0f, ox = 0.0f, oy = 0.0f;
            if (projection.find("_LR") != std::string::npos) {
                sx = 0.5f;
                ox = eye == 1 ? 0.5f : 0.0f;
            } else if (projection.find("_TB") != std::string::npos) {
                sy = 0.5f;
                oy = eye == 0 ? 0.5f : 0.0f;
            }

            glUniform2f(glGetUniformLocation(activeProgram,"uUvScale"), sx, sy);
            glUniform2f(glGetUniformLocation(activeProgram,"uUvOffset"), ox, oy);
            glUniform1f(
                glGetUniformLocation(activeProgram,"uYawOffset"),
                mode=="panorama" ? sceneYaw/360.0f : 0.0f
            );
            glUniform1i(
                glGetUniformLocation(activeProgram,"uHalfSphere"),
                projection.rfind("180",0)==0 ? 1 : 0
            );

            glActiveTexture(GL_TEXTURE0);
            if (video) glBindTexture(GL_TEXTURE_EXTERNAL_OES, videoTexture);
            else glBindTexture(GL_TEXTURE_2D, texture);
            glUniform1i(glGetUniformLocation(activeProgram, "uTex"), 0);

            glBindVertexArray(drawVao);
            glDrawElements(GL_TRIANGLES, drawCount, indexType, nullptr);
            glBindVertexArray(0);
            if (video) glBindTexture(GL_TEXTURE_EXTERNAL_OES,0);
            else glBindTexture(GL_TEXTURE_2D, 0);
        }

        const Mat4 projectionM = projectionFromFov(view.fov);
        glUseProgram(reticleProgram);
        glUniformMatrix4fv(
            glGetUniformLocation(reticleProgram, "uProjection"),
            1,
            GL_FALSE,
            projectionM.m
        );
        if (gazeTarget) {
            glUniform4f(glGetUniformLocation(reticleProgram, "uColor"), 0.46f, 0.91f, 0.84f, 1.0f);
        } else {
            glUniform4f(glGetUniformLocation(reticleProgram, "uColor"), 1.0f, 1.0f, 1.0f, 0.75f);
        }
        glDrawArrays(GL_POINTS, 0, 1);

        glBindFramebuffer(GL_FRAMEBUFFER, 0);
    }

    void destroy() {
        clearMultires();
        if (texture) glDeleteTextures(1, &texture);
        if (stlVbo) glDeleteBuffers(1,&stlVbo);
        if (stlVao) glDeleteVertexArrays(1,&stlVao);
        if (quadIbo) glDeleteBuffers(1,&quadIbo);
        if (quadVbo) glDeleteBuffers(1,&quadVbo);
        if (quadVao) glDeleteVertexArrays(1,&quadVao);
        if (fbo) glDeleteFramebuffers(1, &fbo);
        if (ibo) glDeleteBuffers(1, &ibo);
        if (vbo) glDeleteBuffers(1, &vbo);
        if (vao) glDeleteVertexArrays(1, &vao);
        if (program) glDeleteProgram(program);
        if (videoProgram) glDeleteProgram(videoProgram);
        if (reticleProgram) glDeleteProgram(reticleProgram);
        if (stlProgram) glDeleteProgram(stlProgram);
        texture = fbo = ibo = vbo = vao = program = videoProgram = reticleProgram = stlProgram = 0;
        videoTexture=0;
        quadVao=quadVbo=quadIbo=stlVao=stlVbo=0;
        stlVertexCount=0;
    }
};

struct Swapchain {
    XrSwapchain handle = XR_NULL_HANDLE;
    int32_t width = 0;
    int32_t height = 0;
    std::vector<XrSwapchainImageOpenGLESKHR> images;
};

class OpenXrApp {
public:
    explicit OpenXrApp(android_app* app)
        : app_(app), jni_(app) {}

    ~OpenXrApp() {
        shutdown();
    }

    bool init() {
        if (!initLoader()) return false;
        if (!createInstance()) return false;
        if (!createSystem()) return false;
        if (!egl_.create()) {
            jni_.toast("Не удалось создать OpenGL ES context");
            return false;
        }
        if (!createSession()) return false;
        if (!createActions()) return false;
        if (!renderer_.init()) return false;
        if (!createSpaces()) return false;
        if (!createSwapchains()) return false;
        chooseBlendMode();
        refreshScene(true);
        return true;
    }

    void run() {
        bool exit = false;
        while (!exit && app_ && !app_->destroyRequested) {
            int events = 0;
            android_poll_source* source = nullptr;
            while (ALooper_pollOnce(sessionRunning_ ? 0 : 50, nullptr, &events,
                                    reinterpret_cast<void**>(&source)) >= 0) {
                if (source) source->process(app_, source);
                if (app_->destroyRequested) {
                    exit = true;
                    break;
                }
                if (sessionRunning_) break;
            }

            pollXrEvents(exit);
            if (exit || !sessionRunning_) continue;

            refreshScene(false);
            renderFrame();
        }
    }

private:
    android_app* app_ = nullptr;
    JniBridge jni_;
    EglState egl_;
    Renderer renderer_;
    AndroidVideoPlayer video_;

    XrInstance instance_ = XR_NULL_HANDLE;
    XrSystemId systemId_ = XR_NULL_SYSTEM_ID;
    XrSession session_ = XR_NULL_HANDLE;
    XrSpace appSpace_ = XR_NULL_HANDLE;
    XrSessionState sessionState_ = XR_SESSION_STATE_UNKNOWN;
    bool sessionRunning_ = false;

    XrActionSet actionSet_ = XR_NULL_HANDLE;
    XrAction selectAction_ = XR_NULL_HANDLE;
    XrAction triggerAction_ = XR_NULL_HANDLE;
    XrAction recenterAction_ = XR_NULL_HANDLE;
    std::array<XrPath,2> handPaths_{XR_NULL_PATH,XR_NULL_PATH};
    bool previousSelect_ = false;
    bool previousRecenter_ = false;
    float recenterYaw_ = 0.0f;

    XrEnvironmentBlendMode blendMode_ = XR_ENVIRONMENT_BLEND_MODE_OPAQUE;
    std::vector<XrViewConfigurationView> viewConfigs_;
    std::vector<XrView> views_;
    std::vector<Swapchain> swapchains_;

    int sceneRevision_ = -1;
    std::string sceneId_;
    std::string sceneType_;
    std::string sceneSource_;
    std::string sceneProjection_;
    std::string sceneKind_;
    float sceneYaw_ = 0.0f;
    float scenePitch_ = 0.0f;
    std::vector<Hotspot> hotspots_;

    std::vector<ObjectFrameRef> objectFrames_;
    int objectSectors_ = 1;
    int objectRows_ = 1;
    int objectStartSector_ = 0;
    int objectStartRow_ = 0;
    int objectCurrentSector_ = -1;
    int objectCurrentRow_ = -1;

    std::string gazeId_;
    std::chrono::steady_clock::time_point gazeSince_{};
    std::chrono::steady_clock::time_point gazeCooldownUntil_{};

    bool xrOk(XrResult result, const char* where) {
        if (XR_SUCCEEDED(result)) return true;
        char buffer[XR_MAX_RESULT_STRING_SIZE]{};
        if (instance_ != XR_NULL_HANDLE) xrResultToString(instance_, result, buffer);
        LOGE("%s failed: %d %s", where, result, buffer);
        return false;
    }

    bool initLoader() {
        PFN_xrInitializeLoaderKHR initLoader = nullptr;
        XrResult r = xrGetInstanceProcAddr(
            XR_NULL_HANDLE,
            "xrInitializeLoaderKHR",
            reinterpret_cast<PFN_xrVoidFunction*>(&initLoader)
        );
        if (XR_FAILED(r) || !initLoader) {
            jni_.toast("OpenXR loader initialization недоступна");
            return false;
        }

        XrLoaderInitInfoAndroidKHR initInfo{XR_TYPE_LOADER_INIT_INFO_ANDROID_KHR};
        initInfo.applicationVM = app_->activity->vm;
        initInfo.applicationContext = app_->activity->clazz;
        return XR_SUCCEEDED(initLoader(
            reinterpret_cast<const XrLoaderInitInfoBaseHeaderKHR*>(&initInfo)
        ));
    }

    bool createInstance() {
        std::array<const char*, 2> extensions = {
            XR_KHR_ANDROID_CREATE_INSTANCE_EXTENSION_NAME,
            XR_KHR_OPENGL_ES_ENABLE_EXTENSION_NAME
        };

        XrInstanceCreateInfoAndroidKHR androidInfo{XR_TYPE_INSTANCE_CREATE_INFO_ANDROID_KHR};
        androidInfo.applicationVM = app_->activity->vm;
        androidInfo.applicationActivity = app_->activity->clazz;

        XrInstanceCreateInfo createInfo{XR_TYPE_INSTANCE_CREATE_INFO};
        createInfo.next = &androidInfo;
        std::strncpy(createInfo.applicationInfo.applicationName, "OpenXR Tour Player",
                     XR_MAX_APPLICATION_NAME_SIZE - 1);
        std::strncpy(createInfo.applicationInfo.engineName, "3DPL Native",
                     XR_MAX_ENGINE_NAME_SIZE - 1);
        createInfo.applicationInfo.applicationVersion = 1;
        createInfo.applicationInfo.engineVersion = 1;
        createInfo.applicationInfo.apiVersion = XR_CURRENT_API_VERSION;
        createInfo.enabledExtensionCount = static_cast<uint32_t>(extensions.size());
        createInfo.enabledExtensionNames = extensions.data();

        return xrOk(xrCreateInstance(&createInfo, &instance_), "xrCreateInstance");
    }

    bool createSystem() {
        XrSystemGetInfo info{XR_TYPE_SYSTEM_GET_INFO};
        info.formFactor = XR_FORM_FACTOR_HEAD_MOUNTED_DISPLAY;
        if (!xrOk(xrGetSystem(instance_, &info, &systemId_), "xrGetSystem")) {
            jni_.toast("OpenXR HMD runtime не найден");
            return false;
        }
        return true;
    }

    bool createSession() {
        PFN_xrGetOpenGLESGraphicsRequirementsKHR getRequirements = nullptr;
        if (!xrOk(
                xrGetInstanceProcAddr(
                    instance_,
                    "xrGetOpenGLESGraphicsRequirementsKHR",
                    reinterpret_cast<PFN_xrVoidFunction*>(&getRequirements)
                ),
                "xrGetOpenGLESGraphicsRequirementsKHR proc"
            ) || !getRequirements) {
            return false;
        }

        XrGraphicsRequirementsOpenGLESKHR requirements{
            XR_TYPE_GRAPHICS_REQUIREMENTS_OPENGL_ES_KHR
        };
        if (!xrOk(getRequirements(instance_, systemId_, &requirements), "graphics requirements")) {
            return false;
        }

        XrGraphicsBindingOpenGLESAndroidKHR binding{
            XR_TYPE_GRAPHICS_BINDING_OPENGL_ES_ANDROID_KHR
        };
        binding.display = egl_.display;
        binding.config = egl_.config;
        binding.context = egl_.context;

        XrSessionCreateInfo createInfo{XR_TYPE_SESSION_CREATE_INFO};
        createInfo.next = &binding;
        createInfo.systemId = systemId_;
        return xrOk(xrCreateSession(instance_, &createInfo, &session_), "xrCreateSession");
    }

    bool createActions() {
        XrActionSetCreateInfo setInfo{XR_TYPE_ACTION_SET_CREATE_INFO};
        std::strncpy(setInfo.actionSetName,"tour",XR_MAX_ACTION_SET_NAME_SIZE-1);
        std::strncpy(setInfo.localizedActionSetName,"Tour controls",XR_MAX_LOCALIZED_ACTION_SET_NAME_SIZE-1);
        setInfo.priority=0;
        if(!xrOk(xrCreateActionSet(instance_,&setInfo,&actionSet_),"xrCreateActionSet")) return false;

        xrStringToPath(instance_,"/user/hand/left",&handPaths_[0]);
        xrStringToPath(instance_,"/user/hand/right",&handPaths_[1]);

        auto makeAction=[&](XrActionType type,const char* name,const char* localized,XrAction& out)->bool{
            XrActionCreateInfo info{XR_TYPE_ACTION_CREATE_INFO};
            info.actionType=type;
            std::strncpy(info.actionName,name,XR_MAX_ACTION_NAME_SIZE-1);
            std::strncpy(info.localizedActionName,localized,XR_MAX_LOCALIZED_ACTION_NAME_SIZE-1);
            info.countSubactionPaths=static_cast<uint32_t>(handPaths_.size());
            info.subactionPaths=handPaths_.data();
            return xrOk(xrCreateAction(actionSet_,&info,&out),"xrCreateAction");
        };

        if(!makeAction(XR_ACTION_TYPE_BOOLEAN_INPUT,"select","Select",selectAction_)) return false;
        if(!makeAction(XR_ACTION_TYPE_FLOAT_INPUT,"trigger","Trigger",triggerAction_)) return false;
        if(!makeAction(XR_ACTION_TYPE_BOOLEAN_INPUT,"recenter","Recenter",recenterAction_)) return false;

        XrPath simpleProfile=XR_NULL_PATH;
        xrStringToPath(instance_,"/interaction_profiles/khr/simple_controller",&simpleProfile);
        std::vector<XrActionSuggestedBinding> simpleBindings;
        for(auto hand:handPaths_){
            char path[128]{};
            const bool left=hand==handPaths_[0];
            std::snprintf(path,sizeof(path),"/user/hand/%s/input/select/click",left?"left":"right");
            XrPath p=XR_NULL_PATH; xrStringToPath(instance_,path,&p);
            simpleBindings.push_back({selectAction_,p});

            std::snprintf(path,sizeof(path),"/user/hand/%s/input/menu/click",left?"left":"right");
            p=XR_NULL_PATH; xrStringToPath(instance_,path,&p);
            simpleBindings.push_back({recenterAction_,p});
        }
        XrInteractionProfileSuggestedBinding simpleSuggest{XR_TYPE_INTERACTION_PROFILE_SUGGESTED_BINDING};
        simpleSuggest.interactionProfile=simpleProfile;
        simpleSuggest.countSuggestedBindings=static_cast<uint32_t>(simpleBindings.size());
        simpleSuggest.suggestedBindings=simpleBindings.data();
        xrSuggestInteractionProfileBindings(instance_,&simpleSuggest);

        XrPath touchProfile=XR_NULL_PATH;
        xrStringToPath(instance_,"/interaction_profiles/oculus/touch_controller",&touchProfile);
        std::vector<XrActionSuggestedBinding> touchBindings;
        for(int i=0;i<2;i++){
            const char* side=i==0?"left":"right";
            char path[128]{};
            std::snprintf(path,sizeof(path),"/user/hand/%s/input/trigger/value",side);
            XrPath p=XR_NULL_PATH; xrStringToPath(instance_,path,&p);
            touchBindings.push_back({triggerAction_,p});
            std::snprintf(path,sizeof(path),"/user/hand/%s/input/%s/click",side,i==0?"x":"a");
            p=XR_NULL_PATH; xrStringToPath(instance_,path,&p);
            touchBindings.push_back({recenterAction_,p});
        }
        XrInteractionProfileSuggestedBinding touchSuggest{XR_TYPE_INTERACTION_PROFILE_SUGGESTED_BINDING};
        touchSuggest.interactionProfile=touchProfile;
        touchSuggest.countSuggestedBindings=static_cast<uint32_t>(touchBindings.size());
        touchSuggest.suggestedBindings=touchBindings.data();
        xrSuggestInteractionProfileBindings(instance_,&touchSuggest);

        XrSessionActionSetsAttachInfo attach{XR_TYPE_SESSION_ACTION_SETS_ATTACH_INFO};
        attach.countActionSets=1;
        attach.actionSets=&actionSet_;
        return xrOk(xrAttachSessionActionSets(session_,&attach),"xrAttachSessionActionSets");
    }

    void syncActions() {
        if(actionSet_==XR_NULL_HANDLE || session_==XR_NULL_HANDLE) return;
        XrActiveActionSet active{};
        active.actionSet=actionSet_;
        XrActionsSyncInfo sync{XR_TYPE_ACTIONS_SYNC_INFO};
        sync.countActiveActionSets=1;
        sync.activeActionSets=&active;
        if(XR_FAILED(xrSyncActions(session_,&sync))) return;

        bool select=false;
        bool recenter=false;

        for(auto hand:handPaths_){
            XrActionStateGetInfo get{XR_TYPE_ACTION_STATE_GET_INFO};
            get.subactionPath=hand;

            get.action=selectAction_;
            XrActionStateBoolean b{XR_TYPE_ACTION_STATE_BOOLEAN};
            if(XR_SUCCEEDED(xrGetActionStateBoolean(session_,&get,&b)) && b.isActive && b.currentState) select=true;

            get.action=triggerAction_;
            XrActionStateFloat fl{XR_TYPE_ACTION_STATE_FLOAT};
            if(XR_SUCCEEDED(xrGetActionStateFloat(session_,&get,&fl)) && fl.isActive && fl.currentState>0.7f) select=true;

            get.action=recenterAction_;
            XrActionStateBoolean rc{XR_TYPE_ACTION_STATE_BOOLEAN};
            if(XR_SUCCEEDED(xrGetActionStateBoolean(session_,&get,&rc)) && rc.isActive && rc.currentState) recenter=true;
        }

        if(select && !previousSelect_ && !gazeId_.empty()){
            if(jni_.activateHotspot(gazeId_)) refreshScene(true);
            gazeCooldownUntil_=std::chrono::steady_clock::now()+std::chrono::milliseconds(900);
        }
        if(recenter && !previousRecenter_ && !views_.empty()){
            float yaw=0,pitch=0;
            poseForwardYawPitch(views_[0].pose,yaw,pitch);
            recenterYaw_=yaw;
            jni_.toast("OpenXR: центр обновлён");
        }
        previousSelect_=select;
        previousRecenter_=recenter;
    }

    bool createSpaces() {
        XrReferenceSpaceCreateInfo spaceInfo{XR_TYPE_REFERENCE_SPACE_CREATE_INFO};
        spaceInfo.referenceSpaceType = XR_REFERENCE_SPACE_TYPE_LOCAL;
        spaceInfo.poseInReferenceSpace.orientation.w = 1.0f;
        return xrOk(xrCreateReferenceSpace(session_, &spaceInfo, &appSpace_), "xrCreateReferenceSpace");
    }

    bool createSwapchains() {
        uint32_t viewCount = 0;
        if (!xrOk(
                xrEnumerateViewConfigurationViews(
                    instance_,
                    systemId_,
                    XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO,
                    0,
                    &viewCount,
                    nullptr
                ),
                "xrEnumerateViewConfigurationViews count"
            ) || viewCount == 0) {
            return false;
        }

        viewConfigs_.assign(viewCount, {XR_TYPE_VIEW_CONFIGURATION_VIEW});
        if (!xrOk(
                xrEnumerateViewConfigurationViews(
                    instance_,
                    systemId_,
                    XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO,
                    viewCount,
                    &viewCount,
                    viewConfigs_.data()
                ),
                "xrEnumerateViewConfigurationViews"
            )) {
            return false;
        }

        views_.assign(viewCount, {XR_TYPE_VIEW});

        uint32_t formatCount = 0;
        xrEnumerateSwapchainFormats(session_, 0, &formatCount, nullptr);
        std::vector<int64_t> formats(formatCount);
        xrEnumerateSwapchainFormats(session_, formatCount, &formatCount, formats.data());

        int64_t chosen = formats.empty() ? GL_RGBA8 : formats.front();
        for (int64_t f : formats) {
            if (f == GL_SRGB8_ALPHA8) { chosen = f; break; }
            if (f == GL_RGBA8) chosen = f;
        }

        swapchains_.resize(viewCount);
        for (uint32_t i = 0; i < viewCount; ++i) {
            Swapchain& sc = swapchains_[i];
            sc.width = static_cast<int32_t>(viewConfigs_[i].recommendedImageRectWidth);
            sc.height = static_cast<int32_t>(viewConfigs_[i].recommendedImageRectHeight);

            XrSwapchainCreateInfo ci{XR_TYPE_SWAPCHAIN_CREATE_INFO};
            ci.usageFlags = XR_SWAPCHAIN_USAGE_COLOR_ATTACHMENT_BIT | XR_SWAPCHAIN_USAGE_SAMPLED_BIT;
            ci.format = chosen;
            ci.sampleCount = 1;
            ci.width = static_cast<uint32_t>(sc.width);
            ci.height = static_cast<uint32_t>(sc.height);
            ci.faceCount = 1;
            ci.arraySize = 1;
            ci.mipCount = 1;

            if (!xrOk(xrCreateSwapchain(session_, &ci, &sc.handle), "xrCreateSwapchain")) {
                return false;
            }

            uint32_t imageCount = 0;
            xrEnumerateSwapchainImages(sc.handle, 0, &imageCount, nullptr);
            sc.images.assign(imageCount, {XR_TYPE_SWAPCHAIN_IMAGE_OPENGL_ES_KHR});
            if (!xrOk(
                    xrEnumerateSwapchainImages(
                        sc.handle,
                        imageCount,
                        &imageCount,
                        reinterpret_cast<XrSwapchainImageBaseHeader*>(sc.images.data())
                    ),
                    "xrEnumerateSwapchainImages"
                )) {
                return false;
            }
        }

        return true;
    }

    void chooseBlendMode() {
        uint32_t count = 0;
        if (XR_FAILED(xrEnumerateEnvironmentBlendModes(
                instance_, systemId_, XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO,
                0, &count, nullptr)) || count == 0) {
            blendMode_ = XR_ENVIRONMENT_BLEND_MODE_OPAQUE;
            return;
        }
        std::vector<XrEnvironmentBlendMode> modes(count);
        xrEnumerateEnvironmentBlendModes(
            instance_, systemId_, XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO,
            count, &count, modes.data());
        blendMode_ = modes.front();
        for (auto mode : modes) {
            if (mode == XR_ENVIRONMENT_BLEND_MODE_OPAQUE) {
                blendMode_ = mode;
                break;
            }
        }
    }

    void pollXrEvents(bool& exit) {
        XrEventDataBuffer event{XR_TYPE_EVENT_DATA_BUFFER};
        while (xrPollEvent(instance_, &event) == XR_SUCCESS) {
            if (event.type == XR_TYPE_EVENT_DATA_SESSION_STATE_CHANGED) {
                const auto* changed =
                    reinterpret_cast<const XrEventDataSessionStateChanged*>(&event);
                sessionState_ = changed->state;

                if (sessionState_ == XR_SESSION_STATE_READY && !sessionRunning_) {
                    XrSessionBeginInfo begin{XR_TYPE_SESSION_BEGIN_INFO};
                    begin.primaryViewConfigurationType =
                        XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;
                    if (xrOk(xrBeginSession(session_, &begin), "xrBeginSession")) {
                        sessionRunning_ = true;
                    }
                } else if (sessionState_ == XR_SESSION_STATE_STOPPING && sessionRunning_) {
                    xrEndSession(session_);
                    sessionRunning_ = false;
                } else if (
                    sessionState_ == XR_SESSION_STATE_EXITING ||
                    sessionState_ == XR_SESSION_STATE_LOSS_PENDING
                ) {
                    exit = true;
                }
            } else if (event.type == XR_TYPE_EVENT_DATA_INSTANCE_LOSS_PENDING) {
                exit = true;
            }

            event = {XR_TYPE_EVENT_DATA_BUFFER};
        }
    }

    bool loadObjectFrame(int row,int sector) {
        if(objectFrames_.empty()) return false;
        sector=((sector%objectSectors_)+objectSectors_)%objectSectors_;
        row=std::clamp(row,0,std::max(0,objectRows_-1));
        for(const auto& frame:objectFrames_){
            if(frame.row!=row || frame.sector!=sector) continue;
            int w=0,h=0;
            GLuint tex=jni_.loadTexture(frame.path,&w,&h);
            if(!tex) return false;
            renderer_.setMode("object360");
            renderer_.setObjectAspect(h>0 ? static_cast<float>(w)/static_cast<float>(h) : 1.5f);
            renderer_.setSceneTexture(tex,"flat",0,0);
            objectCurrentRow_=row;
            objectCurrentSector_=sector;
            return true;
        }
        return false;
    }

    void updateObjectFrame(const std::vector<XrView>& views) {
        if(sceneType_!="object360" || views.empty() || objectFrames_.empty()) return;
        float yaw=0,pitch=0;
        poseForwardYawPitch(views[0].pose,yaw,pitch);
        yaw=wrapAngle(yaw-recenterYaw_);

        const float step=360.0f/std::max(1,objectSectors_);
        int sector=objectStartSector_ + static_cast<int>(std::lround(yaw/step));
        sector=((sector%objectSectors_)+objectSectors_)%objectSectors_;

        int row=objectStartRow_;
        if(objectRows_>=3){
            if(pitch>13.0f) row=0;
            else if(pitch<-13.0f) row=objectRows_-1;
            else row=objectRows_/2;
        } else if(objectRows_==2){
            row=pitch>=0.0f ? 0 : 1;
        }

        if(row!=objectCurrentRow_ || sector!=objectCurrentSector_){
            loadObjectFrame(row,sector);
        }
    }

    void refreshScene(bool force) {
        const int revision = jni_.callInt("nativeGetSceneRevision");
        if (!force && revision == sceneRevision_) return;

        sceneRevision_ = revision;
        sceneId_ = jni_.callString("nativeGetSceneId");
        sceneType_ = jni_.callString("nativeGetSceneType");
        sceneSource_ = jni_.callString("nativeGetSceneSource");
        sceneProjection_ = jni_.callString("nativeGetSceneProjection");
        sceneKind_ = jni_.callString("nativeGetSceneKind");
        sceneYaw_ = jni_.callFloat("nativeGetSceneYaw");
        scenePitch_ = jni_.callFloat("nativeGetScenePitch");
        hotspots_ = parseHotspots(jni_.callString("nativeGetHotspotsPacked"));

        gazeId_.clear();
        if(video_.valid()) video_.close(jni_.env);
        objectFrames_.clear();
        objectCurrentRow_=-1;
        objectCurrentSector_=-1;

        if(sceneType_=="object360"){
            objectSectors_=std::max(1,jni_.callInt("nativeGetObjectSectors"));
            objectRows_=std::max(1,jni_.callInt("nativeGetObjectRows"));
            objectStartSector_=jni_.callInt("nativeGetObjectStartSector");
            objectStartRow_=jni_.callInt("nativeGetObjectStartRow");
            objectFrames_=parseObjectFrames(jni_.callString("nativeGetObjectFramesPacked"));
            renderer_.setMode("object360");
            if(!loadObjectFrame(objectStartRow_,objectStartSector_)){
                renderer_.setSceneTexture(0,"flat",0,0);
                jni_.toast("Object360: кадры не найдены");
            }
            return;
        }

        if(sceneType_=="stl"){
            std::vector<StlVertex> vertices;
            if(!loadStlMesh(sceneSource_,vertices)){
                renderer_.setMode("stl");
                renderer_.setSceneTexture(0,"360",0,0);
                jni_.toast("STL: не удалось прочитать модель");
                return;
            }
            normalizeStlMesh(vertices);
            renderer_.setMode("stl");
            renderer_.setSceneTexture(0,"360",sceneYaw_,scenePitch_);
            if(!renderer_.setStlMesh(
                vertices,
                jni_.callFloat("nativeGetStlZoom"),
                jni_.callBool("nativeGetStlWireframe"),
                jni_.callInt("nativeGetStlColorRgb")
            )){
                jni_.toast("STL: ошибка GPU");
            }
            return;
        }

        renderer_.setMode("panorama");

        if (sceneType_ != "panorama" && sceneType_ != "xr") {
            renderer_.setSceneTexture(0, "360", 0, 0);
            jni_.toast("Тип сцены пока не поддерживается");
            return;
        }
        if (sceneKind_ == "video") {
            renderer_.setMode("panorama");
            renderer_.setSceneTexture(0, sceneProjection_, sceneYaw_, scenePitch_);
            if(video_.open(jni_.env,sceneSource_,true)){
                renderer_.setVideoTexture(video_.texture(),sceneProjection_,sceneYaw_,scenePitch_);
                LOGI("Video scene %s projection=%s",sceneSource_.c_str(),sceneProjection_.c_str());
            }else{
                jni_.toast("OpenXR video: MediaPlayer не смог открыть файл");
            }
            return;
        }

        int w = 0, h = 0;
        GLuint tex = jni_.loadTexture(sceneSource_, &w, &h);
        if (!tex) {
            renderer_.setSceneTexture(0, sceneProjection_, sceneYaw_, scenePitch_);
            jni_.toast("Не удалось открыть изображение сцены");
            return;
        }
        renderer_.setSceneTexture(tex, sceneProjection_, sceneYaw_, scenePitch_);
        LOGI("Scene %s %s %dx%d projection=%s",
             sceneId_.c_str(), sceneSource_.c_str(), w, h, sceneProjection_.c_str());
    }

    bool updateGaze(const std::vector<XrView>& views) {
        if (views.empty()) return false;

        float headYaw = 0.0f, headPitch = 0.0f;
        poseForwardYawPitch(views[0].pose, headYaw, headPitch);
        const float logicalYaw = wrapAngle(headYaw - recenterYaw_ + sceneYaw_);
        const float logicalPitch = headPitch + scenePitch_;

        const Hotspot* best = nullptr;
        float bestDistance = 999.0f;

        for (const auto& h : hotspots_) {
            const float dy = wrapAngle(h.yaw - logicalYaw);
            const float dp = h.pitch - logicalPitch;
            const float distance = std::sqrt(dy * dy + dp * dp);
            if (distance < bestDistance && distance <= 7.5f) {
                bestDistance = distance;
                best = &h;
            }
        }

        const auto now = std::chrono::steady_clock::now();
        if (!best) {
            gazeId_.clear();
            return false;
        }

        if (gazeId_ != best->id) {
            gazeId_ = best->id;
            gazeSince_ = now;
            return true;
        }

        const auto dwellMs =
            std::chrono::duration_cast<std::chrono::milliseconds>(now - gazeSince_).count();

        if (dwellMs >= 1100 && now >= gazeCooldownUntil_) {
            gazeCooldownUntil_ = now + std::chrono::milliseconds(1400);
            gazeSince_ = now;
            const std::string selected = gazeId_;
            if (jni_.activateHotspot(selected)) {
                refreshScene(true);
            }
        }

        return true;
    }

    void renderFrame() {
        XrFrameWaitInfo waitInfo{XR_TYPE_FRAME_WAIT_INFO};
        XrFrameState frameState{XR_TYPE_FRAME_STATE};
        if (!xrOk(xrWaitFrame(session_, &waitInfo, &frameState), "xrWaitFrame")) return;

        XrFrameBeginInfo beginInfo{XR_TYPE_FRAME_BEGIN_INFO};
        if (!xrOk(xrBeginFrame(session_, &beginInfo), "xrBeginFrame")) return;

        std::vector<XrCompositionLayerProjectionView> layerViews;
        XrCompositionLayerProjection layer{XR_TYPE_COMPOSITION_LAYER_PROJECTION};
        const XrCompositionLayerBaseHeader* layers[1]{};
        uint32_t layerCount = 0;

        if (frameState.shouldRender) {
            XrViewState viewState{XR_TYPE_VIEW_STATE};
            XrViewLocateInfo locateInfo{XR_TYPE_VIEW_LOCATE_INFO};
            locateInfo.viewConfigurationType = XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;
            locateInfo.displayTime = frameState.predictedDisplayTime;
            locateInfo.space = appSpace_;

            uint32_t viewCount = 0;
            if (XR_SUCCEEDED(xrLocateViews(
                    session_,
                    &locateInfo,
                    &viewState,
                    static_cast<uint32_t>(views_.size()),
                    &viewCount,
                    views_.data()
                )) &&
                (viewState.viewStateFlags & XR_VIEW_STATE_POSITION_VALID_BIT) &&
                (viewState.viewStateFlags & XR_VIEW_STATE_ORIENTATION_VALID_BIT)) {

                if(video_.valid()) video_.update(jni_.env);
                updateObjectFrame(views_);
                syncActions();
                const bool gazeTarget = updateGaze(views_);
                layerViews.assign(viewCount, {XR_TYPE_COMPOSITION_LAYER_PROJECTION_VIEW});

                for (uint32_t i = 0; i < viewCount && i < swapchains_.size(); ++i) {
                    Swapchain& sc = swapchains_[i];

                    uint32_t imageIndex = 0;
                    XrSwapchainImageAcquireInfo acquire{XR_TYPE_SWAPCHAIN_IMAGE_ACQUIRE_INFO};
                    if (XR_FAILED(xrAcquireSwapchainImage(sc.handle, &acquire, &imageIndex))) continue;

                    XrSwapchainImageWaitInfo imageWait{XR_TYPE_SWAPCHAIN_IMAGE_WAIT_INFO};
                    imageWait.timeout = XR_INFINITE_DURATION;
                    if (XR_FAILED(xrWaitSwapchainImage(sc.handle, &imageWait))) continue;

                    renderer_.render(
                        sc.images[imageIndex].image,
                        sc.width,
                        sc.height,
                        views_[i],
                        static_cast<int>(i),
                        gazeTarget
                    );

                    XrSwapchainImageReleaseInfo release{XR_TYPE_SWAPCHAIN_IMAGE_RELEASE_INFO};
                    xrReleaseSwapchainImage(sc.handle, &release);

                    auto& pv = layerViews[i];
                    pv.pose = views_[i].pose;
                    pv.fov = views_[i].fov;
                    pv.subImage.swapchain = sc.handle;
                    pv.subImage.imageRect.offset = {0, 0};
                    pv.subImage.imageRect.extent = {sc.width, sc.height};
                    pv.subImage.imageArrayIndex = 0;
                }

                layer.space = appSpace_;
                layer.viewCount = static_cast<uint32_t>(layerViews.size());
                layer.views = layerViews.data();
                layers[0] = reinterpret_cast<const XrCompositionLayerBaseHeader*>(&layer);
                layerCount = 1;
            }
        }

        XrFrameEndInfo endInfo{XR_TYPE_FRAME_END_INFO};
        endInfo.displayTime = frameState.predictedDisplayTime;
        endInfo.environmentBlendMode = blendMode_;
        endInfo.layerCount = layerCount;
        endInfo.layers = layerCount ? layers : nullptr;
        xrEndFrame(session_, &endInfo);
    }

    void shutdown() {
        if(video_.valid()) video_.close(jni_.env);
        renderer_.destroy();

        for (auto& sc : swapchains_) {
            if (sc.handle != XR_NULL_HANDLE) xrDestroySwapchain(sc.handle);
            sc.handle = XR_NULL_HANDLE;
        }
        swapchains_.clear();

        if (selectAction_ != XR_NULL_HANDLE) { xrDestroyAction(selectAction_); selectAction_=XR_NULL_HANDLE; }
        if (triggerAction_ != XR_NULL_HANDLE) { xrDestroyAction(triggerAction_); triggerAction_=XR_NULL_HANDLE; }
        if (recenterAction_ != XR_NULL_HANDLE) { xrDestroyAction(recenterAction_); recenterAction_=XR_NULL_HANDLE; }
        if (actionSet_ != XR_NULL_HANDLE) { xrDestroyActionSet(actionSet_); actionSet_=XR_NULL_HANDLE; }

        if (appSpace_ != XR_NULL_HANDLE) {
            xrDestroySpace(appSpace_);
            appSpace_ = XR_NULL_HANDLE;
        }
        if (session_ != XR_NULL_HANDLE) {
            if (sessionRunning_) xrEndSession(session_);
            xrDestroySession(session_);
            session_ = XR_NULL_HANDLE;
        }
        egl_.destroy();
        if (instance_ != XR_NULL_HANDLE) {
            xrDestroyInstance(instance_);
            instance_ = XR_NULL_HANDLE;
        }
    }
};

} // namespace

void android_main(android_app* app) {
    app_dummy();
    LOGI("OpenXR Tour Player native start");

    OpenXrApp xr(app);
    if (!xr.init()) {
        LOGE("OpenXR initialization failed");
        ANativeActivity_finish(app->activity);
        return;
    }

    xr.run();
    LOGI("OpenXR Tour Player native stop");
}
