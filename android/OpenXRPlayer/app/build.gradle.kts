plugins {
    id("com.android.application")
}

android {
    namespace = "ru.specdpo.openxrplayer"
    compileSdk = 36
    ndkVersion = "27.2.12479018"

    defaultConfig {
        applicationId = "ru.specdpo.openxrplayer"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        externalNativeBuild {
            cmake {
                cppFlags += listOf("-std=c++20", "-Wall", "-Wextra")
                arguments += listOf("-DANDROID_STL=c++_shared")
            }
        }
        ndk {
            abiFilters += listOf("arm64-v8a")
        }
    }

    buildFeatures {
        prefab = true
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("org.khronos.openxr:openxr_loader_for_android:1.1.63")
}
