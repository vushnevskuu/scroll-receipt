package day.outthere.scrollreceipt.data.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import day.outthere.scrollreceipt.ScrollReceiptApplication
import java.util.concurrent.TimeUnit

class UsageSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val application = applicationContext as ScrollReceiptApplication
        val container = application.container

        if (!container.usageAccessController.isGranted()) return Result.success()
        if (container.authRepository.storedSession() == null) return Result.success()

        val usage = container.usageRepository.today()
        return when (container.syncRepository.sync(usage)) {
            SyncResult.Synced, SyncResult.NotSignedIn -> Result.success()
            is SyncResult.Failed -> Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "scroll-receipt-usage-sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<UsageSyncWorker>(
                1,
                TimeUnit.HOURS,
                15,
                TimeUnit.MINUTES,
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
