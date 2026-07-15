pluginManagement {
    plugins {
        id("org.jetbrains.kotlin.jvm") version "2.3.21"
    }
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

rootProject.name = "scroll-receipt-core"
