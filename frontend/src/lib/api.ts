/**
 * Utility for making authenticated API requests to the Django backend.
 * Uses Django Session Authentication via cookies (credentials: 'include').
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include', // Send session cookie cross-origin
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `API Error: ${response.status}`);
    }

    return response.json();
}
