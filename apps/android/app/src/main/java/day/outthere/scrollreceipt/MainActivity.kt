package day.outthere.scrollreceipt

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import day.outthere.scrollreceipt.ui.MainViewModel
import day.outthere.scrollreceipt.ui.ScrollReceiptScreen
import day.outthere.scrollreceipt.ui.theme.ScrollReceiptTheme

class MainActivity : ComponentActivity() {
    private val applicationContainer: AppContainer
        get() = (application as ScrollReceiptApplication).container

    private val viewModel: MainViewModel by viewModels {
        MainViewModel.Factory(application, applicationContainer)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val state by viewModel.uiState.collectAsStateWithLifecycle()
            val usageAccessLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.StartActivityForResult(),
            ) {
                viewModel.refreshUsage()
            }

            LifecycleResumeEffect(Unit) {
                viewModel.refreshUsage()
                onPauseOrDispose { }
            }

            ScrollReceiptTheme {
                ScrollReceiptScreen(
                    state = state,
                    onOpenUsageAccess = {
                        usageAccessLauncher.launch(applicationContainer.usageAccessController.settingsIntent())
                    },
                    onRefresh = viewModel::refreshUsage,
                    onRateChange = viewModel::updateRateInput,
                    onSaveRate = viewModel::saveHourlyRate,
                    onEmailChange = viewModel::updateEmail,
                    onCodeChange = viewModel::updateCode,
                    onSendCode = viewModel::sendCode,
                    onVerifyCode = viewModel::verifyCode,
                    onSync = { viewModel.syncNow() },
                    onSignOut = viewModel::signOut,
                    onDeleteAccount = viewModel::deleteAccount,
                )
            }
        }
    }
}
