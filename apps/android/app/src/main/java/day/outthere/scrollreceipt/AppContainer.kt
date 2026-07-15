package day.outthere.scrollreceipt

import android.content.Context
import day.outthere.scrollreceipt.data.auth.SessionVault
import day.outthere.scrollreceipt.data.auth.SupabaseAuthRepository
import day.outthere.scrollreceipt.data.network.HttpJsonClient
import day.outthere.scrollreceipt.data.settings.AppPreferences
import day.outthere.scrollreceipt.data.sync.SupabaseSyncRepository
import day.outthere.scrollreceipt.data.usage.AndroidUsageRepository
import day.outthere.scrollreceipt.data.usage.UsageAccessController

class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    private val http = HttpJsonClient()

    val preferences = AppPreferences(appContext)
    val usageAccessController = UsageAccessController(appContext)
    val usageRepository = AndroidUsageRepository(appContext, usageAccessController)
    val authRepository = SupabaseAuthRepository(http, SessionVault(appContext))
    val syncRepository = SupabaseSyncRepository(http, authRepository, preferences)
}
