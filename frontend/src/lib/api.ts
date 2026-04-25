/**
 * Utility for making authenticated API requests to the Django backend.
 * Uses Django Session Authentication via cookies (credentials: 'include').
 */
// Robust API base resolution
// Robust API base resolution - Locked to production by default
const getApiBase = () => {
    if (typeof window === 'undefined') {
        return process.env.NEXT_PUBLIC_API_URL || 'https://api.glysmork.com/api';
    }
    
    const hostname = window.location.hostname;
    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
    
    if (isLocalDev) {
        return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
    }
    
    // For production (any domain or IP), use the env variable if set, else fallback to same-host port 8000
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }

    // Default to the correct production API if no env variable is set
    return 'https://api.glysmork.com/api';
};

const API_BASE_URL = getApiBase();

function getCsrfToken(): string {
    if (typeof document === 'undefined') return '';
    const name = 'csrftoken';
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) return decodeURIComponent(value);
    }
    return '';
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
    };

    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    // Only set application/json if not sending FormData
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    // Include CSRF token for state-changing requests
    if (isMutation) {
        const csrfToken = getCsrfToken();
        if (csrfToken) headers['X-CSRFToken'] = csrfToken;
    }

    // Construct and normalize URL (prevents double slashes)
    const rawUrl = `${API_BASE_URL}${endpoint}`;
    const url = rawUrl.replace(/([^:]\/)\/+/g, "$1");

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Send session cookie cross-origin
    });

    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || errorData?.detail || `API Error: ${response.status}`);
    }

    return response.json();
}
