package day.outthere.scrollreceipt.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import day.outthere.scrollreceipt.ui.theme.Ink
import day.outthere.scrollreceipt.ui.theme.Paper

@Composable
fun PrinterSlot(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(24.dp)
            .background(Ink, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .background(Paper.copy(alpha = 0.18f), RoundedCornerShape(4.dp)),
    )
}

@Composable
fun ReceiptPaper(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val notchRadius = with(LocalDensity.current) { 6.dp.toPx() }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Paper, PerforatedBottomShape(notchRadius))
            .padding(start = 22.dp, end = 22.dp, top = 30.dp, bottom = 34.dp),
        content = content,
    )
}

@Composable
fun DottedRule(modifier: Modifier = Modifier) {
    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(1.dp),
    ) {
        drawLine(
            color = Ink.copy(alpha = 0.32f),
            start = androidx.compose.ui.geometry.Offset.Zero,
            end = androidx.compose.ui.geometry.Offset(size.width, 0f),
            strokeWidth = 1.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 5.dp.toPx())),
        )
    }
}

private class PerforatedBottomShape(
    private val notchRadius: Float,
) : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        val radius = notchRadius.coerceAtMost(size.width / 20f)
        val path = Path().apply {
            moveTo(0f, 0f)
            lineTo(size.width, 0f)
            lineTo(size.width, size.height)

            var center = size.width - radius * 2
            while (center > radius) {
                lineTo(center + radius, size.height)
                cubicTo(
                    center + radius,
                    size.height - radius * 1.25f,
                    center - radius,
                    size.height - radius * 1.25f,
                    center - radius,
                    size.height,
                )
                center -= radius * 4
            }

            lineTo(0f, size.height)
            close()
        }
        return Outline.Generic(path)
    }
}
