package day.outthere.scrollreceipt.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import day.outthere.scrollreceipt.ui.theme.CharcoalRaised
import day.outthere.scrollreceipt.ui.theme.MutedOnDark
import day.outthere.scrollreceipt.ui.theme.ReceiptGreenBright

@Composable
fun EmailReceiptPanel(
    backendConfigured: Boolean,
    signedInEmail: String?,
    emailInput: String,
    codeInput: String,
    codeSent: Boolean,
    isBusy: Boolean,
    onEmailChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onSendCode: () -> Unit,
    onVerifyCode: () -> Unit,
    onSync: () -> Unit,
    onSignOut: () -> Unit,
    onDeleteAccount: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var consentChecked by rememberSaveable { mutableStateOf(false) }
    var showDeleteConfirmation by rememberSaveable { mutableStateOf(false) }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = CharcoalRaised,
        border = BorderStroke(1.dp, MutedOnDark.copy(alpha = 0.32f)),
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
                    text = "DAILY EMAIL RECEIPT",
                    style = MaterialTheme.typography.titleMedium,
                )
                if (signedInEmail != null) {
                    Text(
                        text = "CONNECTED",
                        style = MaterialTheme.typography.labelLarge,
                        color = ReceiptGreenBright,
                    )
                }
            }

            when {
                !backendConfigured -> {
                    Text(
                        text = "The Supabase client values are missing from this build. " +
                            "Local usage tracking still works.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MutedOnDark,
                    )
                }
                signedInEmail != null -> {
                    Text(
                        text = signedInEmail,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        text = "Only daily totals are synced. A receipt is scheduled for " +
                            "18:00 in your current timezone.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MutedOnDark,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        OutlinedButton(
                            onClick = onSync,
                            modifier = Modifier.weight(1f),
                            enabled = !isBusy,
                        ) {
                            Text("SYNC NOW")
                        }
                        TextButton(
                            onClick = onSignOut,
                            enabled = !isBusy,
                        ) {
                            Text("DISCONNECT")
                        }
                    }
                    TextButton(
                        onClick = { showDeleteConfirmation = true },
                        modifier = Modifier.align(Alignment.End),
                        enabled = !isBusy,
                    ) {
                        Text(
                            text = "DELETE ACCOUNT",
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
                else -> {
                    Text(
                        text = "Sign in with the code from your email to receive the same " +
                            "end-of-day receipt across browser and Android.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MutedOnDark,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Checkbox(
                            checked = consentChecked,
                            onCheckedChange = { consentChecked = it },
                        )
                        Text(
                            text = "I agree to sync daily platform totals, date, timezone, " +
                                "and a random device ID for email receipts.",
                            modifier = Modifier.padding(top = 11.dp),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    OutlinedTextField(
                        value = emailInput,
                        onValueChange = onEmailChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("EMAIL") },
                        enabled = !isBusy,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    )
                    Button(
                        onClick = onSendCode,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = consentChecked && emailInput.isNotBlank() && !isBusy,
                    ) {
                        Text(if (codeSent) "SEND CODE AGAIN" else "SEND SIGN-IN CODE")
                    }

                    AnimatedVisibility(visible = codeSent) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                text = "Enter the numeric code from the email. The browser " +
                                    "link is optional.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MutedOnDark,
                            )
                            OutlinedTextField(
                                value = codeInput,
                                onValueChange = onCodeChange,
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("EMAIL CODE") },
                                enabled = !isBusy,
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.NumberPassword,
                                ),
                            )
                            Button(
                                onClick = onVerifyCode,
                                modifier = Modifier.fillMaxWidth(),
                                enabled = codeInput.length >= 6 && !isBusy,
                            ) {
                                Text("VERIFY AND ENABLE RECEIPTS")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("DELETE ACCOUNT?") },
            text = {
                Text(
                    "This permanently removes your email account and all synced usage totals. " +
                        "Local receipts will continue to work."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirmation = false
                        onDeleteAccount()
                    },
                ) {
                    Text(
                        text = "DELETE PERMANENTLY",
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) {
                    Text("CANCEL")
                }
            },
        )
    }
}
