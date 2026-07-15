package day.outthere.scrollreceipt.core

object ReceiptCalculator {
    fun calculate(usage: DailyUsage, hourlyRate: Double): ReceiptSummary {
        val safeRate = hourlyRate.coerceAtLeast(0.0)
        val lines = usage.platforms
            .filter { it.seconds > 0 }
            .map { item ->
                ReceiptLine(
                    platform = item.platform,
                    seconds = item.seconds,
                    cost = item.seconds / 3600.0 * safeRate,
                )
            }

        return ReceiptSummary(
            lines = lines,
            totalSeconds = usage.totalSeconds,
            totalCost = lines.sumOf { it.cost },
        )
    }
}
