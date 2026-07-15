package day.outthere.scrollreceipt.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
    val userId: String,
    val email: String,
)

@Serializable
internal data class AuthUserDto(
    val id: String,
    val email: String? = null,
)

@Serializable
internal data class AuthResponseDto(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("refresh_token")
    val refreshToken: String,
    @SerialName("expires_in")
    val expiresIn: Long = 3600,
    @SerialName("expires_at")
    val expiresAt: Long? = null,
    val user: AuthUserDto,
)

@Serializable
internal data class ErrorResponseDto(
    val error: String? = null,
    val message: String? = null,
    @SerialName("error_description")
    val errorDescription: String? = null,
)
