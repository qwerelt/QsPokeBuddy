plugins {
}

android {
    namespace = "com.example.qspokebuddy"

    defaultConfig {
        applicationId = "com.example.qspokebuddy"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            optimization {
                enable = false
            }
        }
    }
}

dependencies {
}