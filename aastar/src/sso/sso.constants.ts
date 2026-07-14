// Dependency-free constants shared between the SSO module and the cos72 session
// JwtStrategy (which must REJECT SSO tokens without importing the heavy sso.service chain).

/** Audience claim stamped on every SSO session token. */
export const SSO_TOKEN_AUDIENCE = "myvote";

/** SSO session token TTL — 10 minutes. */
export const SSO_TOKEN_TTL_SECONDS = 600;
