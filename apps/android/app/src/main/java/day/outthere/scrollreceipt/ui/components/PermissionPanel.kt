package day.outthere.scrollreceipt.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import day.outthere.scrollreceipt.ui.theme.CharcoalRaised
import day.outthere.scrollreceipt.ui.theme.MutedOnDark
import day.outthere.scrollreceipt.ui.theme.ReceiptGreenBright
import day.outthere.scrollreceipt.ui.theme.WarningAmber

@Composable
fun PermissionPanel(
    permissionGranted: Boolean,
    onOpenSettings: () -> Unit,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = CharcoalRaised,
        border = BorderStroke(
            1.dp,
            if (permissionGranted) ReceiptGreenBright.copy(alpha = 0.55f) else WarningAmber,
        ),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "USAGE ACCESS",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = if (permissionGranted) "ACTIVE" else "REQUIRED",
                    style = MaterialTheme.typography.labelLarge,
                    color = if (permissionGranted) ReceiptGreenBright else WarningAmber,
                )
            }
            Text(
                text = "Scroll Receipt reads only the total foreground duration for TikTok, " +
                    "Instagram, and YouTube. It does not read screen content, messages, " +
                    "searches, or keystrokes.",
                style = MaterialTheme.typography.bodyMedium,
                color = MutedOnDark,
            )
            Text(
                text = "YouTube and Instagram are reported as whole-app time because Android " +
                    "does not expose the active feed without Accessibility Service.",
                style = MaterialTheme.typography.bodyMedium,
                color = MutedOnDark,
            )
            if (permissionGranted) {
                OutlinedButton(
                    onClick = onRefresh,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("REFRESH RECEIPT")
                }
            } else {
                Button(
                    onClick = onOpenSettings,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = WarningAmber,
                        contentColor = Color(0xFF1A1710),
                    ),
                ) {
                    Text("OPEN USAGE ACCESS")
                }
            }
        }
    }
}
