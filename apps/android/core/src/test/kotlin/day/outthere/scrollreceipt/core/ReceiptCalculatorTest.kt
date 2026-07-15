package day.outthere.scrollreceipt.core

import kotlin.test.Test
import kotlin.test.assertEquals

class ReceiptCalculatorTest {
    @Test
    fun calculatesMoneyFromPlatformTime() {
        val usage = DailyUsage(
            localDate = "2026-07-10",
            timezone = "Asia/Bangkok",
            platforms = listOf(
                PlatformUsage(AppPlatform.INSTAGRAM, 1800),
                PlatformUsage(AppPlatform.YOUTUBE, 900),
                PlatformUsage(AppPlatform.TIKTOK, 900),
            ),
        )

        val receipt = ReceiptCalculator.calculate(usage, hourlyRate = 20.0)

        assertEquals(3600, receipt.totalSeconds)
        assertEquals(20.0, receipt.totalCost, absoluteTolerance = 0.0001)
        assertEquals(3, receipt.lines.size)
    }

    @Test
    fun clampsNegativeRateAndHidesEmptyLines() {
        val usage = DailyUsage(
            localDate = "2026-07-10",
            timezone = "UTC",
            platforms = listOf(
                PlatformUsage(AppPlatform.INSTAGRAM, 0),
                PlatformUsage(AppPlatform.TIKTOK, 60),
            ),
        )

        val receipt = ReceiptCalculator.calculate(usage, hourlyRate = -5.0)

        assertEquals(0.0, receipt.totalCost)
        assertEquals(listOf(AppPlatform.TIKTOK), receipt.lines.map { it.platform })
    }

    @Test
    fun formatsLongDurationsWithoutWrappingHours() {
        assertEquals("27:01:02", ReceiptFormatter.duration(97_262))
        assertEquals("00:00:00", ReceiptFormatter.duration(-1))
    }
}
