package day.outthere.scrollreceipt.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ScrollReceiptColorScheme = darkColorScheme(
    primary = ReceiptGreenBright,
    onPrimary = Ink,
    primaryContainer = ReceiptGreen,
    onPrimaryContainer = Color.White,
    secondary = PaperMuted,
    onSecondary = Ink,
    background = Charcoal,
    onBackground = Paper,
    surface = CharcoalRaised,
    onSurface = Paper,
    surfaceVariant = Color(0xFF323129),
    onSurfaceVariant = MutedOnDark,
    error = ErrorRed,
)

@Composable
fun ScrollReceiptTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ScrollReceiptColorScheme,
        typography = ScrollReceiptTypography,
        content = content,
    )
}
