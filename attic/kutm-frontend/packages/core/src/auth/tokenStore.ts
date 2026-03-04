let accessToken: string | undefined;
let refreshToken: string | undefined;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

export function getRefreshToken() {
  return refreshToken;
}

export function setRefreshToken(token: string | undefined) {
  refreshToken = token;
}
