package day.outthere.scrollreceipt.data.usage

import android.app.usage.UsageStatsManager
import android.content.Context
import day.outthere.scrollreceipt.core.AppPlatform
import day.outthere.scrollreceipt.core.DailyUsage
import day.outthere.scrollreceipt.core.PlatformUsage
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AndroidUsageRepository(
    context: Context,
    private val accessController: UsageAccessController,
) {
    private val usageStatsManager = context.getSystemService(UsageStatsManager::class.java)

    suspend fun today(nowMillis: Long = System.currentTimeMillis()): DailyUsage =
        withContext(Dispatchers.Default) {
            val zone = ZoneId.systemDefault()
            val date = LocalDate.now(zone)
            val startMillis = date.atStartOfDay(zone).toInstant().toEpochMilli()
            val elapsedSeconds = ((nowMillis - startMillis) / 1000).coerceAtLeast(0)

            if (!accessController.isGranted()) {
                return@withContext emptyUsage(date, zone)
            }

            val stats = usageStatsManager.queryAndAggregateUsageStats(startMillis, nowMillis)
            val platforms = AppPlatform.entries.map { platform ->
                val seconds = platform.packageNames.sumOf { packageName ->
                    (stats[packageName]?.totalTimeInForeground ?: 0L) / 1000
                }.coerceIn(0, elapsedSeconds)
                PlatformUsage(platform = platform, seconds = seconds)
            }

            DailyUsage(
                localDate = date.format(DateTimeFormatter.ISO_LOCAL_DATE),
                timezone = zone.id,
                platforms = platforms,
            )
        }

    private fun emptyUsage(date: LocalDate, zone: ZoneId): DailyUsage = DailyUsage(
        localDate = date.format(DateTimeFormatter.ISO_LOCAL_DATE),
        timezone = zone.id,
        platforms = AppPlatform.entries.map { platform ->
            PlatformUsage(platform = platform, seconds = 0)
        },
    )
}
