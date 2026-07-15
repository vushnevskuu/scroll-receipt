package day.outthere.scrollreceipt.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import day.outthere.scrollreceipt.ui.components.DailyReceipt
import day.outthere.scrollreceipt.ui.components.EmailReceiptPanel
import day.outthere.scrollreceipt.ui.components.PermissionPanel
import day.outthere.scrollreceipt.ui.components.PrinterSlot
import day.outthere.scrollreceipt.ui.components.ValuePanel
import day.outthere.scrollreceipt.ui.theme.Charcoal
import day.outthere.scrollreceipt.ui.theme.CharcoalRaised
import day.outthere.scrollreceipt.ui.theme.ErrorRed
import day.outthere.scrollreceipt.ui.theme.MutedOnDark
import day.outthere.scrollreceipt.ui.theme.ReceiptGreenBright

@Composable
fun ScrollReceiptScreen(
    state: MainUiState,
    onOpenUsageAccess: () -> Unit,
    onRefresh: () -> Unit,
    onRateChange: (String) -> Unit,
    onSaveRate: () -> Unit,
    onEmailChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onSendCode: () -> Unit,
    onVerifyCode: () -> Unit,
    onSync: () -> Unit,
    onSignOut: () -> Unit,
    onDeleteAccount: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = Charcoal,
    ) { scaffoldPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(scaffoldPadding),
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    start = 18.dp,
                    end = 18.dp,
                    top = 18.dp,
                    bottom = 36.dp,
                ),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                item {
                    Header()
                }
                item {
                    AnimatedVisibility(visible = state.notice != null) {
                        Notice(
                            message = state.notice.orEmpty(),
                            isError = state.noticeIsError,
                        )
                    }
                }
                item {
                    Column {
                        PrinterSlot(modifier = Modifier.padding(horizontal = 10.dp))
                        DailyReceipt(
                            usage = state.usage,
                            receipt = state.receipt,
                            hourlyRate = state.hourlyRate,
                            permissionGranted = state.permissionGranted,
                            modifier = Modifier.padding(horizontal = 4.dp),
                        )
                    }
                }
                item {
                    PermissionPanel(
                        permissionGranted = state.permissionGranted,
                        onOpenSettings = onOpenUsageAccess,
                        onRefresh = onRefresh,
                    )
                }
                item {
                    ValuePanel(
                        hourlyRateInput = state.hourlyRateInput,
                        onRateChange = onRateChange,
                        onSaveRate = onSaveRate,
                    )
                }
                item {
                    EmailReceiptPanel(
                        backendConfigured = state.backendConfigured,
                        signedInEmail = state.signedInEmail,
                        emailInput = state.emailInput,
                        codeInput = state.codeInput,
                        codeSent = state.codeSent,
                        isBusy = state.isBusy,
                        onEmailChange = onEmailChange,
                        onCodeChange = onCodeChange,
                        onSendCode = onSendCode,
                        onVerifyCode = onVerifyCode,
                        onSync = onSync,
                        onSignOut = onSignOut,
                        onDeleteAccount = onDeleteAccount,
                    )
                }
                item {
                    Text(
                        text = "APP USAGE ONLY  /  NO SCREEN CONTENT  /  V1.0.0",
                        modifier = Modifier.fillMaxWidth(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MutedOnDark,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            if (state.isBusy) {
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                    color = ReceiptGreenBright,
                    trackColor = CharcoalRaised,
                )
            }
        }
    }
}

@Composable
private fun Header() {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = "SCROLL RECEIPT",
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = "ATTENTION, PRINTED DAILY",
            style = MaterialTheme.typography.bodyMedium,
            color = MutedOnDark,
        )
    }
}

@Composable
private fun Notice(message: String, isError: Boolean) {
    val color = if (isError) ErrorRed else ReceiptGreenBright
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = CharcoalRaised,
        border = BorderStroke(1.dp, color.copy(alpha = 0.72f)),
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(14.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = color,
        )
    }
}
