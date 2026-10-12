plugins {
    id("com.android.application")
}

android {
    namespace = "ru.specdpo.object360"
    compileSdk = 36

    defaultConfig {
        applicationId = "ru.specdpo.object360"
        minSdk = 24
        targetSdk = 36
        versionCode = 12
        versionName = "0.9.0"
    }

    buildFeatures {
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.appcompat:appcompat:1.8.0")
    implementation("androidx.activity:activity-ktx:1.13.0")

    val cameraxVersion = "1.6.2"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")

    implementation("com.google.ar:core:1.56.0")

    // Official OpenCV Android AAR. Used for robust rectangular panorama stitching:
    // ORB features -> RANSAC homography -> perspective warp -> overlap blending.
    implementation("org.opencv:opencv:4.14.0")
}
