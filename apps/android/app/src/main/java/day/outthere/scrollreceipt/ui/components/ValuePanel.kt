package day.outthere.scrollreceipt.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import day.outthere.scrollreceipt.core.ReceiptFormatter
import day.outthere.scrollreceipt.ui.theme.CharcoalRaised
import day.outthere.scrollreceipt.ui.theme.MutedOnDark

@Composable
fun ValuePanel(
    hourlyRateInput: String,
    onRateChange: (String) -> Unit,
    onSaveRate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = CharcoalRaised,
        border = BorderStroke(1.dp, MutedOnDark.copy(alpha = 0.32f)),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "VALUE OF YOUR TIME",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = "Set the after-tax value of one hour. The receipt converts app time " +
                    "into an opportunity cost in " + ReceiptFormatter.currencyCode() + ".",
                style = MaterialTheme.typography.bodyMedium,
                color = MutedOnDark,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = hourlyRateInput,
                    onValueChange = onRateChange,
                    modifier = Modifier.weight(1f),
                    label = { Text("PER HOUR") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedButton(onClick = onSaveRate) {
                    Text("SET")
                }
            }
        }
    }
}
