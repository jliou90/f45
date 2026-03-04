from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    otp_code: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RefreshTokenCleanupOut(BaseModel):
    expired_deleted: int
    revoked_deleted: int


class AcceptInviteRequest(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=255)


class PasswordResetConsumeRequest(BaseModel):
    token: str = Field(min_length=20)
    new_password: str = Field(min_length=8, max_length=128)


class MfaEnrollStartOut(BaseModel):
    secret: str
    otpauth_url: str
    mfa_enabled: bool


class MfaCodeIn(BaseModel):
    otp_code: str = Field(min_length=6, max_length=8)


class MfaStatusOut(BaseModel):
    ok: bool
    mfa_enabled: bool
