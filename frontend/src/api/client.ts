import axios from "axios";

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

// If the backend ever returns 401 (session expired or not logged in),
// automatically send the user back to the login page.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/register")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;