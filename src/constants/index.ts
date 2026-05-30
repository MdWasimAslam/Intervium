/**
 * Application-wide constants.
 */

/** App metadata used in layout, navbar and footer. */
export const APP_NAME = "Intervium";
export const APP_DESCRIPTION =
  "A minimal, secure starter app with JWT authentication.";

/** Name of the httpOnly cookie that stores the JWT session token. */
export const SESSION_COOKIE = "intervium_token";

/** How long an issued session token stays valid. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
