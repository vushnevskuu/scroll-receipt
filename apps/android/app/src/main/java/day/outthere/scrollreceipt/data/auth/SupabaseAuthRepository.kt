package day.outthere.scrollreceipt.data.auth

import day.outthere.scrollreceipt.BuildConfig
import day.outthere.scrollreceipt.data.network.HttpJsonClient
import day.outthere.scrollreceipt.data.network.HttpResponse
import kotlin.time.Duration.Companion.minutes
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SupabaseAuthRepository(
    private val http: HttpJsonClient,
    private val sessionVault: SessionVault,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    val isConfigured: Boolean
        get() = BuildConfig.SUPABASE_URL.isNotBlank() &&
            BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()

    fun storedSession(): AuthSession? = sessionVault.load()

    suspend fun sendCode(email: String): Result<Unit> = runCatching {
        checkConfigured()
        val normalizedEmail = email.trim().lowercase()
        require(EMAIL_PATTERN.matches(normalizedEmail)) { "Enter a valid email address." }

        val response = http.request(
            url = endpoint("/functions/v1/send-auth-link"),
            method = "POST",
            headers = publicHeaders(),
            body = json.encodeToString(
                SendCodeRequest(
                    email = normalizedEmail,
                    locale = "en",
                    redirectTo = BuildConfig.PUBLIC_SITE_URL,
                ),
            ),
        )
        requireSuccess(response, "Could not send the sign-in code.")
    }

    suspend fun verifyCode(email: String, code: String): Result<AuthSession> = runCatching {
        checkConfigured()
        val normalizedEmail = email.trim().lowercase()
        val normalizedCode = code.filter(Char::isDigit)
        require(EMAIL_PATTERN.matches(normalizedEmail)) { "Enter a valid email address." }
        require(normalizedCode.length >= 6) { "Enter the code from your email." }

        var latestError = "The code is invalid or expired."
        for (type in listOf("magiclink", "email", "signup")) {
            val response = http.request(
                url = endpoint("/auth/v1/verify"),
                method = "POST",
                headers = publicHeaders(),
                body = json.encodeToString(
                    VerifyCodeRequest(
                        email = normalizedEmail,
                        token = normalizedCode,
                        type = type,
                    ),
                ),
            )
            if (response.isSuccessful) {
                val session = response.toAuthSession()
                sessionVault.save(session)
                return@runCatching session
            }
            latestError = errorMessage(response, latestError)
        }
        error(latestError)
    }

    suspend fun activeSession(): AuthSession? {
        val stored = sessionVault.load() ?: return null
        val refreshThreshold = System.currentTimeMillis() / 1000 + 2.minutes.inWholeSeconds
        if (stored.expiresAt > refreshThreshold) return stored

        return refresh(stored).getOrElse {
            if (stored.expiresAt > System.currentTimeMillis() / 1000) {
                stored
            } else {
                sessionVault.clear()
                null
            }
        }
    }

    suspend fun signOut() {
        val session = sessionVault.load()
        if (session != null && isConfigured) {
            runCatching {
                http.request(
                    url = endpoint("/auth/v1/logout?scope=global"),
                    method = "POST",
                    headers = authenticatedHeaders(session.accessToken),
                )
            }
        }
        sessionVault.clear()
    }

    suspend fun deleteAccount(): Result<Unit> = runCatching {
        checkConfigured()
        val session = activeSession() ?: error("Your session expired. Sign in again.")
        val response = http.request(
            url = endpoint("/functions/v1/delete-account"),
            method = "POST",
            headers = authenticatedHeaders(session.accessToken),
        )
        requireSuccess(response, "Could not delete your account.")
        sessionVault.clear()
    }

    private suspend fun refresh(session: AuthSession): Result<AuthSession> = runCatching {
        checkConfigured()
        val response = http.request(
            url = endpoint("/auth/v1/token?grant_type=refresh_token"),
            method = "POST",
            headers = publicHeaders(),
            body = json.encodeToString(RefreshRequest(refreshToken = session.refreshToken)),
        )
        requireSuccess(response, "Your session expired. Sign in again.")
        val refreshed = response.toAuthSession()
        sessionVault.save(refreshed)
        refreshed
    }

    private fun HttpResponse.toAuthSession(): AuthSession {
        val dto = json.decodeFromString<AuthResponseDto>(body)
        return AuthSession(
            accessToken = dto.accessToken,
            refreshToken = dto.refreshToken,
            expiresAt = dto.expiresAt ?: (System.currentTimeMillis() / 1000 + dto.expiresIn),
            userId = dto.user.id,
            email = dto.user.email.orEmpty().trim().lowercase(),
        )
    }

    private fun publicHeaders(): Map<String, String> = mapOf(
        "apikey" to BuildConfig.SUPABASE_PUBLISHABLE_KEY,
        "Content-Type" to "application/json",
    )

    fun authenticatedHeaders(accessToken: String): Map<String, String> = publicHeaders() + mapOf(
        "Authorization" to "Bearer " + accessToken,
    )

    private fun endpoint(path: String): String =
        BuildConfig.SUPABASE_URL.trimEnd('/') + path

    private fun checkConfigured() {
        check(isConfigured) {
            "Email receipts are not configured in this build."
        }
    }

    private fun requireSuccess(response: HttpResponse, fallback: String) {
        if (!response.isSuccessful) {
            error(errorMessage(response, fallback))
        }
    }

    private fun errorMessage(response: HttpResponse, fallback: String): String =
        runCatching {
            val error = json.decodeFromString<ErrorResponseDto>(response.body)
            error.errorDescription ?: error.message ?: error.error ?: fallback
        }.getOrDefault(fallback)

    companion object {
        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    }
}

@Serializable
private data class SendCodeRequest(
    val email: String,
    val locale: String,
    val redirectTo: String,
)

@Serializable
private data class VerifyCodeRequest(
    val email: String,
    val token: String,
    val type: String,
)

@Serializable
private data class RefreshRequest(
    @SerialName("refresh_token")
    val refreshToken: String,
)
