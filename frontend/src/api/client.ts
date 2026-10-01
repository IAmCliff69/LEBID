import axios from "axios";

// The name of the browser event we fire when the backend says
// "your session is not valid" (401). AuthContext listens for it.
export const SESSION_EXPIRED_EVENT = "lebid:session-expired";

// The central Axios instance for all API calls in Lebid.
// baseURL points to the FastAPI backend.
// withCredentials: true tells the browser to send the HttpOnly
// session cookie automatically on every request.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// If the backend returns 401 (session expired or not logged in) on a
// normal request, tell the app so it can send the user to the login page.
// We do NOT reload the page (that would replay the splash screen).
// The auth requests themselves are ignored here, because a 401 on
// /auth/me just means "nobody is logged in" and a 401 on /auth/login
// just means "wrong password".
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    const isAuthRequest =
      url.includes("/auth/me") ||
      url.includes("/auth/login") ||
      url.includes("/auth/register");

    if (error.response?.status === 401 && !isAuthRequest) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default apiClient;