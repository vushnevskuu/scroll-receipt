package day.outthere.scrollreceipt.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import day.outthere.scrollreceipt.AppContainer
import day.outthere.scrollreceipt.core.AppPlatform
import day.outthere.scrollreceipt.core.DailyUsage
import day.outthere.scrollreceipt.core.PlatformUsage
import day.outthere.scrollreceipt.core.ReceiptCalculator
import day.outthere.scrollreceipt.core.ReceiptSummary
import day.outthere.scrollreceipt.data.sync.SyncResult
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val permissionGranted: Boolean = false,
    val usage: DailyUsage = emptyDailyUsage(),
    val receipt: ReceiptSummary = ReceiptCalculator.calculate(emptyDailyUsage(), 20.0),
    val hourlyRate: Double = 20.0,
    val hourlyRateInput: String = "20",
    val emailInput: String = "",
    val codeInput: String = "",
    val codeSent: Boolean = false,
    val signedInEmail: String? = null,
    val backendConfigured: Boolean = false,
    val isBusy: Boolean = false,
    val notice: String? = null,
    val noticeIsError: Boolean = false,
)

class MainViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {
    private val _uiState = MutableStateFlow(
        MainUiState(
            permissionGranted = container.usageAccessController.isGranted(),
            signedInEmail = container.authRepository.storedSession()?.email,
            backendConfigured = container.authRepository.isConfigured,
        ),
    )
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    private var refreshJob: Job? = null

    init {
        viewModelScope.launch {
            container.preferences.hourlyRate.collectLatest { rate ->
                _uiState.update { state ->
                    state.copy(
                        hourlyRate = rate,
                        hourlyRateInput = compactRate(rate),
                        receipt = ReceiptCalculator.calculate(state.usage, rate),
                    )
                }
            }
        }
        refreshUsage()
    }

    fun refreshUsage() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            val permissionGranted = container.usageAccessController.isGranted()
            val usage = container.usageRepository.today()
            _uiState.update { state ->
                state.copy(
                    permissionGranted = permissionGranted,
                    usage = usage,
                    receipt = ReceiptCalculator.calculate(usage, state.hourlyRate),
                )
            }
        }
    }

    fun updateRateInput(value: String) {
        val filtered = value
            .filter { it.isDigit() || it == '.' }
            .let { raw ->
                val separator = raw.indexOf('.')
                if (separator < 0) raw else {
                    raw.substring(0, separator + 1) +
                        raw.substring(separator + 1).replace(".", "").take(2)
                }
            }
            .take(8)
        _uiState.update { it.copy(hourlyRateInput = filtered) }
    }

    fun saveHourlyRate() {
        val value = _uiState.value.hourlyRateInput.toDoubleOrNull()
        if (value == null || value !in 0.0..10_000.0) {
            showNotice("Enter an hourly rate between 0 and 10,000.", isError = true)
            return
        }
        viewModelScope.launch {
            container.preferences.setHourlyRate(value)
            showNotice("Hourly value updated.", isError = false)
        }
    }

    fun updateEmail(value: String) {
        _uiState.update { it.copy(emailInput = value.take(254), notice = null) }
    }

    fun updateCode(value: String) {
        _uiState.update {
            it.copy(codeInput = value.filter(Char::isDigit).take(8), notice = null)
        }
    }

    fun sendCode() {
        if (_uiState.value.isBusy) return
        viewModelScope.launch {
            setBusy(true)
            container.authRepository.sendCode(_uiState.value.emailInput)
                .onSuccess {
                    _uiState.update { state ->
                        state.copy(
                            codeSent = true,
                            notice = "Code sent. Check your inbox and enter it here.",
                            noticeIsError = false,
                        )
                    }
                }
                .onFailure { error ->
                    showNotice(error.message ?: "Could not send the code.", isError = true)
                }
            setBusy(false)
        }
    }

    fun verifyCode() {
        if (_uiState.value.isBusy) return
        viewModelScope.launch {
            setBusy(true)
            container.authRepository.verifyCode(
                email = _uiState.value.emailInput,
                code = _uiState.value.codeInput,
            )
                .onSuccess { session ->
                    _uiState.update { state ->
                        state.copy(
                            signedInEmail = session.email,
                            codeSent = false,
                            codeInput = "",
                            notice = "Daily email receipts are enabled.",
                            noticeIsError = false,
                        )
                    }
                    syncNow(showProgress = false)
                }
                .onFailure { error ->
                    showNotice(error.message ?: "Could not verify the code.", isError = true)
                }
            setBusy(false)
        }
    }

    fun syncNow(showProgress: Boolean = true) {
        if (_uiState.value.isBusy && showProgress) return
        viewModelScope.launch {
            if (showProgress) setBusy(true)
            val permissionGranted = container.usageAccessController.isGranted()
            if (!permissionGranted) {
                showNotice("Grant Usage Access before syncing.", isError = true)
            } else {
                val usage = container.usageRepository.today()
                when (val result = container.syncRepository.sync(usage)) {
                    SyncResult.Synced -> showNotice("Today's app time is synced.", isError = false)
                    SyncResult.NotSignedIn -> showNotice(
                        "Sign in to enable daily email receipts.",
                        isError = true,
                    )
                    is SyncResult.Failed -> showNotice(result.message, isError = true)
                }
                _uiState.update { state ->
                    state.copy(
                        usage = usage,
                        receipt = ReceiptCalculator.calculate(usage, state.hourlyRate),
                    )
                }
            }
            if (showProgress) setBusy(false)
        }
    }

    fun signOut() {
        if (_uiState.value.isBusy) return
        viewModelScope.launch {
            setBusy(true)
            container.authRepository.signOut()
            _uiState.update {
                it.copy(
                    signedInEmail = null,
                    codeSent = false,
                    codeInput = "",
                    notice = "Email receipts disconnected. Local tracking still works.",
                    noticeIsError = false,
                )
            }
            setBusy(false)
        }
    }

    fun deleteAccount() {
        if (_uiState.value.isBusy) return
        viewModelScope.launch {
            setBusy(true)
            container.authRepository.deleteAccount()
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            signedInEmail = null,
                            codeSent = false,
                            codeInput = "",
                            notice = "Account and synced totals deleted. Local receipts still work.",
                            noticeIsError = false,
                        )
                    }
                }
                .onFailure { error ->
                    showNotice(error.message ?: "Could not delete your account.", isError = true)
                }
            setBusy(false)
        }
    }

    fun clearNotice() {
        _uiState.update { it.copy(notice = null) }
    }

    private fun showNotice(message: String, isError: Boolean) {
        _uiState.update { it.copy(notice = message, noticeIsError = isError) }
    }

    private fun setBusy(value: Boolean) {
        _uiState.update { it.copy(isBusy = value) }
    }

    private fun compactRate(rate: Double): String =
        if (rate % 1.0 == 0.0) {
            rate.toLong().toString()
        } else {
            String.format(Locale.US, "%.2f", rate)
        }

    class Factory(
        private val application: Application,
        private val container: AppContainer,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            MainViewModel(application, container) as T
    }
}

private fun emptyDailyUsage(): DailyUsage {
    val zone = ZoneId.systemDefault()
    return DailyUsage(
        localDate = LocalDate.now(zone).format(DateTimeFormatter.ISO_LOCAL_DATE),
        timezone = zone.id,
        platforms = AppPlatform.entries.map { PlatformUsage(it, 0) },
    )
}
