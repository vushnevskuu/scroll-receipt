package day.outthere.scrollreceipt.core

import java.math.RoundingMode
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

object ReceiptFormatter {
    fun duration(totalSeconds: Long): String {
        val safeSeconds = totalSeconds.coerceAtLeast(0)
        val hours = safeSeconds / 3600
        val minutes = (safeSeconds % 3600) / 60
        val seconds = safeSeconds % 60
        return "%02d:%02d:%02d".format(Locale.US, hours, minutes, seconds)
    }

    fun money(amount: Double, locale: Locale = Locale.getDefault()): String {
        val formatter = NumberFormat.getCurrencyInstance(locale).apply {
            roundingMode = RoundingMode.HALF_UP
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
        return formatter.format(amount.coerceAtLeast(0.0))
    }

    fun currencyCode(locale: Locale = Locale.getDefault()): String =
        runCatching { Currency.getInstance(locale).currencyCode }.getOrDefault("USD")
}
