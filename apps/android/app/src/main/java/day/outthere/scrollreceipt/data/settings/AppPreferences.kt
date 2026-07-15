package day.outthere.scrollreceipt.data.settings

import android.content.Context
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.scrollReceiptDataStore by preferencesDataStore(name = "scroll_receipt")

class AppPreferences(private val context: Context) {
    val hourlyRate: Flow<Double> = context.scrollReceiptDataStore.data.map { preferences ->
        preferences[HOURLY_RATE] ?: DEFAULT_HOURLY_RATE
    }

    suspend fun setHourlyRate(value: Double) {
        context.scrollReceiptDataStore.edit { preferences ->
            preferences[HOURLY_RATE] = value.coerceIn(0.0, 10_000.0)
        }
    }

    suspend fun deviceId(): String {
        val existing = context.scrollReceiptDataStore.data.first()[DEVICE_ID]
        if (existing != null) return existing

        val generated = UUID.randomUUID().toString()
        context.scrollReceiptDataStore.edit { preferences ->
            if (preferences[DEVICE_ID] == null) {
                preferences[DEVICE_ID] = generated
            }
        }
        return context.scrollReceiptDataStore.data.first()[DEVICE_ID] ?: generated
    }

    companion object {
        private val HOURLY_RATE = doublePreferencesKey("hourly_rate")
        private val DEVICE_ID = stringPreferencesKey("device_id")
        const val DEFAULT_HOURLY_RATE = 20.0
    }
}
