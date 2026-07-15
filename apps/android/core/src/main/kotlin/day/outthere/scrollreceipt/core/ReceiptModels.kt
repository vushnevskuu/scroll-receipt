package day.outthere.scrollreceipt.core

enum class AppPlatform(
    val remoteName: String,
    val displayName: String,
    val packageNames: Set<String>,
) {
    INSTAGRAM(
        remoteName = "instagram",
        displayName = "INSTAGRAM",
        packageNames = setOf("com.instagram.android"),
    ),
    YOUTUBE(
        remoteName = "youtube",
        displayName = "YOUTUBE",
        packageNames = setOf("com.google.android.youtube"),
    ),
    TIKTOK(
        remoteName = "tiktok",
        displayName = "TIKTOK",
        packageNames = setOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill"),
    ),
}

data class PlatformUsage(
    val platform: AppPlatform,
    val seconds: Long,
)

data class DailyUsage(
    val localDate: String,
    val timezone: String,
    val platforms: List<PlatformUsage>,
) {
    val totalSeconds: Long = platforms.sumOf { it.seconds }
}

data class ReceiptLine(
    val platform: AppPlatform,
    val seconds: Long,
    val cost: Double,
)

data class ReceiptSummary(
    val lines: List<ReceiptLine>,
    val totalSeconds: Long,
    val totalCost: Double,
)
