import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_BASE_URL } from "@/constants";

/**
 * Pre-configured Axios instance used by every service.
 * Centralising the config keeps base URL, headers, timeout and
 * interceptors in one place.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* -------------------------------------------------------------------------- */
/*                             Request interceptor                            */
/* -------------------------------------------------------------------------- */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach an auth token here when you add authentication, e.g.:
    // const token = getToken();
    // if (token) config.headers.Authorization = `Bearer ${token}`;

    if (process.env.NODE_ENV === "development") {
      // Helpful request logging during local development.
      console.debug(`[api] → ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* -------------------------------------------------------------------------- */
/*                            Response interceptor                            */
/* -------------------------------------------------------------------------- */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Normalise every error into a consistent, human-readable message.
    const message = extractErrorMessage(error);

    if (process.env.NODE_ENV === "development") {
      console.error(`[api] ✗ ${message}`);
    }

    // Re-throw a clean Error so callers don't need to know about Axios.
    return Promise.reject(new Error(message));
  },
);

/**
 * Pull the most useful message out of an Axios error.
 * Prefers the server's `message` field, then falls back to status / network.
 */
function extractErrorMessage(error: AxiosError): string {
  const data = error.response?.data as { message?: string } | undefined;

  if (data?.message) return data.message;

  if (error.response) {
    return `Request failed with status ${error.response.status}.`;
  }

  if (error.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  return error.message || "An unexpected network error occurred.";
}
