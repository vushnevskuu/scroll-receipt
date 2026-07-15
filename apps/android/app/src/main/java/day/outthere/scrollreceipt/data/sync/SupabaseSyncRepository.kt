package day.outthere.scrollreceipt.data.sync

import day.outthere.scrollreceipt.BuildConfig
import day.outthere.scrollreceipt.core.DailyUsage
import day.outthere.scrollreceipt.data.auth.AuthSession
import day.outthere.scrollreceipt.data.auth.SupabaseAuthRepository
import day.outthere.scrollreceipt.data.network.HttpJsonClient
import day.outthere.scrollreceipt.data.network.HttpResponse
import day.outthere.scrollreceipt.data.settings.AppPreferences
import java.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

sealed interface SyncResult {
    data object Synced : SyncResult
    data object NotSignedIn : SyncResult
    data class Failed(val message: String) : SyncResult
}

class SupabaseSyncRepository(
    private val http: HttpJsonClient,
    private val auth: SupabaseAuthRepository,
    private val preferences: AppPreferences,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    suspend fun sync(usage: DailyUsage): SyncResult {
        val session = auth.activeSession() ?: return SyncResult.NotSignedIn
        return runCatching {
            upsertProfile(session, usage.timezone)

            val clientUpdatedAt = Instant.now().toString()
            val deviceId = preferences.deviceId()
            val records = usage.platforms.map { item ->
                UsageSyncRecord(
                    deviceId = deviceId,
                    localDate = usage.localDate,
                    timezone = usage.timezone,
                    platform = item.platform.remoteName,
                    seconds = item.seconds.coerceIn(0, 86_400).toInt(),
                    views = 0,
                    clientUpdatedAt = clientUpdatedAt,
                )
            }

            val response = http.request(
                url = endpoint("/functions/v1/sync-usage"),
                method = "POST",
                headers = auth.authenticatedHeaders(session.accessToken),
                body = json.encodeToString(UsageSyncBatch(records)),
            )
            if (!response.isSuccessful) {
                error(response.errorMessage("Could not sync today's app time."))
            }
            SyncResult.Synced
        }.getOrElse { error ->
            SyncResult.Failed(error.message ?: "Sync failed.")
        }
    }

    private suspend fun upsertProfile(session: AuthSession, timezone: String) {
        val profile = UserProfile(
            userId = session.userId,
            email = session.email,
            timezone = timezone,
            reportEnabled = true,
            reportTimeLocal = "18:00",
            locale = "en",
        )
        val response = http.request(
            url = endpoint("/rest/v1/profiles?on_conflict=user_id"),
            method = "POST",
            headers = auth.authenticatedHeaders(session.accessToken) + mapOf(
                "Prefer" to "resolution=merge-duplicates,return=minimal",
            ),
            body = json.encodeToString(profile),
        )
        if (!response.isSuccessful) {
            error(response.errorMessage("Could not enable daily receipts."))
        }
    }

    private fun endpoint(path: String): String =
        BuildConfig.SUPABASE_URL.trimEnd('/') + path

    private fun HttpResponse.errorMessage(
        fallback: String,
    ): String = runCatching {
        json.decodeFromString<SyncError>(body).let { it.message ?: it.error ?: fallback }
    }.getOrDefault(fallback)
}

@Serializable
private data class UsageSyncBatch(
    val records: List<UsageSyncRecord>,
)

@Serializable
private data class UsageSyncRecord(
    val deviceId: String,
    val localDate: String,
    val timezone: String,
    val platform: String,
    val seconds: Int,
    val views: Int,
    val clientUpdatedAt: String,
)

@Serializable
private data class UserProfile(
    @SerialName("user_id")
    val userId: String,
    val email: String,
    val timezone: String,
    @SerialName("report_enabled")
    val reportEnabled: Boolean,
    @SerialName("report_time_local")
    val reportTimeLocal: String,
    val locale: String,
)

@Serializable
private data class SyncError(
    val error: String? = null,
    val message: String? = null,
)
