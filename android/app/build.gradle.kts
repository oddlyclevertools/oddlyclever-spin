plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.chaquo.python")
}

// server.py and web/ are copied from music-tool/ on every build, so the APK never drifts from the PC app.
val appAssets = layout.buildDirectory.dir("ocm-assets")
val copyAppAssets by tasks.registering(Sync::class) {
    from(rootDir.resolve("..")) { include("server.py", "updates.py", "THIRD_PARTY_NOTICES*"); into("app") } // notices: About > Licences
    from(rootDir.resolve("../web")) { into("app/web") }
    into(appAssets)
}

android {
    namespace = "com.oddlyclever.music"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.oddlyclever.music"
        minSdk = 24
        targetSdk = 35
        // -Pvcode / -Pvname override these for update tests only (an "older" build to update from).
        // music-tool/VERSION is the one version for both apps; versionCode = major*10000 + minor*100 + patch.
        val appVersion = rootDir.resolve("../VERSION").readText().trim()
        versionCode = (findProperty("vcode") as String?)?.toInt()
            ?: appVersion.split(".").map(String::toInt).let { (a, b, c) -> a * 10000 + b * 100 + c }
        versionName = findProperty("vname") as String? ?: appVersion
        // -Pabis=arm64-v8a,x86_64 adds the emulator ABI for testing.
        ndk { abiFilters += (findProperty("abis") as String? ?: "arm64-v8a").split(",") }
        // -Pwebdebug=true (build.sh test only) lets chrome://inspect attach to the WebView. Never on in phone builds.
        buildConfigField("boolean", "WEB_DEBUG", (findProperty("webdebug") == "true").toString())
        // -Psidetest=true (build.sh sidetest): installs beside the real app, with its own id, name and songs folder,
        // so tests on a real phone never touch the real library.
        val side = findProperty("sidetest") == "true"
        if (side) applicationIdSuffix = ".sidetest"
        manifestPlaceholders["appLabel"] = if (side) "Spin (test)" else "OddlyClever Spin"
        buildConfigField("String", "SONGS_DIR", if (side) "\"OddlyClever Spin Test\"" else "\"OddlyClever Spin\"")
    }
    buildFeatures { buildConfig = true }

    signingConfigs {
        create("release") {
            // From ~/.config/godot-keys/oddlyclever-music.env (build.sh loads it); never stored in the repo.
            storeFile = System.getenv("OCM_KEYSTORE")?.let(::file)
            storePassword = System.getenv("OCM_KEYSTORE_PASS")
            keyAlias = System.getenv("OCM_KEY_ALIAS")
            keyPassword = System.getenv("OCM_KEY_PASS")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    sourceSets["main"].assets.srcDir(appAssets)
    packaging { jniLibs.useLegacyPackaging = true } // extract libqjs.so so it can be run as a program

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

tasks.named("preBuild") { dependsOn(copyAppAssets) }

chaquopy {
    defaultConfig {
        version = "3.12"
        System.getenv("OCM_BUILD_PYTHON")?.let { buildPython(it) }
        pip {
            // yt-dlp's [default] extras without native wheels (brotli, pycryptodomex, websockets) are skipped.
            install("yt-dlp==2026.10.26")
            install("yt-dlp-ejs==0.8.0")
            install("ytmusicapi==1.12.3")
            install("certifi")
            install("requests")
        }
        extractPackages("certifi", "yt_dlp_ejs")
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.webkit:webkit:1.12.1")
}
