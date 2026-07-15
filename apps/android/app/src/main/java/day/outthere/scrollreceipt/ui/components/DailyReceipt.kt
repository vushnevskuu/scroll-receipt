package day.outthere.scrollreceipt.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import day.outthere.scrollreceipt.core.DailyUsage
import day.outthere.scrollreceipt.core.ReceiptFormatter
import day.outthere.scrollreceipt.core.ReceiptSummary
import day.outthere.scrollreceipt.ui.theme.Ink
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun DailyReceipt(
    usage: DailyUsage,
    receipt: ReceiptSummary,
    hourlyRate: Double,
    permissionGranted: Boolean,
    modifier: Modifier = Modifier,
) {
    ReceiptPaper(modifier = modifier.animateContentSize()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "ATTENTION ACCOUNTING",
                style = MaterialTheme.typography.bodyMedium,
                color = Ink.copy(alpha = 0.62f),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "WASTED TIME",
                style = MaterialTheme.typography.displaySmall,
                color = Ink,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "ANDROID APP  /  TODAY",
                style = MaterialTheme.typography.bodyMedium,
                color = Ink.copy(alpha = 0.56f),
            )

            Spacer(Modifier.height(20.dp))
            DottedRule()
            Spacer(Modifier.height(14.dp))

            ReceiptPair("DATE", formatDate(usage.localDate))
            ReceiptPair("STATUS", if (permissionGranted) "TRACKING" else "NEEDS ACCESS")

            Spacer(Modifier.height(14.dp))
            DottedRule()
            Spacer(Modifier.height(14.dp))

            Text(
                text = "APP TIME",
                modifier = Modifier.fillMaxWidth(),
                style = MaterialTheme.typography.titleMedium,
                color = Ink,
            )
            Spacer(Modifier.height(10.dp))

            if (receipt.lines.isEmpty()) {
                Text(
                    text = if (permissionGranted) {
                        "NO TRACKED APP TIME YET"
                    } else {
                        "OPEN USAGE ACCESS TO PRINT DATA"
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Ink.copy(alpha = 0.55f),
                    textAlign = TextAlign.Center,
                )
            } else {
                receipt.lines.forEach { line ->
                    ReceiptItem(
                        label = line.platform.displayName,
                        duration = ReceiptFormatter.duration(line.seconds),
                        cost = ReceiptFormatter.money(line.cost),
                    )
                }
            }

            Spacer(Modifier.height(14.dp))
            DottedRule()
            Spacer(Modifier.height(14.dp))

            ReceiptPair(
                label = "TOTAL TIME",
                value = ReceiptFormatter.duration(receipt.totalSeconds),
                bold = true,
            )
            ReceiptPair(
                label = "OPPORTUNITY COST",
                value = ReceiptFormatter.money(receipt.totalCost),
                bold = true,
            )

            Spacer(Modifier.height(16.dp))
            DottedRule()
            Spacer(Modifier.height(14.dp))

            Text(
                text = "VALUED AT " + ReceiptFormatter.money(hourlyRate) + " / HOUR",
                style = MaterialTheme.typography.bodyMedium,
                color = Ink.copy(alpha = 0.62f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "PAID WITH YOUR ATTENTION",
                style = MaterialTheme.typography.labelLarge,
                color = Ink,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun ReceiptItem(label: String, duration: String, cost: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyMedium,
            color = Ink,
        )
        Text(
            text = duration,
            modifier = Modifier.width(82.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = Ink,
            textAlign = TextAlign.End,
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = cost,
            modifier = Modifier.width(74.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = Ink,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun ReceiptPair(
    label: String,
    value: String,
    bold: Boolean = false,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = Ink,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = Ink,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            textAlign = TextAlign.End,
        )
    }
}

private fun formatDate(value: String): String = runCatching {
    LocalDate.parse(value).format(
        DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US),
    )
}.getOrDefault(value)
