package day.outthere.scrollreceipt

import android.app.Application
import day.outthere.scrollreceipt.data.sync.UsageSyncWorker

class ScrollReceiptApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        UsageSyncWorker.schedule(this)
    }
}
