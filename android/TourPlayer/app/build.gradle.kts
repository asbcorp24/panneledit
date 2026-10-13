plugins {
    id("com.android.application")
}

android {
    namespace = "ru.specdpo.tourplayer"
    compileSdk = 36

    defaultConfig {
        applicationId = "ru.specdpo.tourplayer"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.webkit:webkit:1.14.0")
}
