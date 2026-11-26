// Resolves the backend API URL dynamically so that both relative /api and custom VITE_API_URL work seamlessly
const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname === '127.0.0.1' && envUrl.includes('localhost')) {
        return envUrl.replace('localhost', '127.0.0.1');
      }
      if (hostname === 'localhost' && envUrl.includes('127.0.0.1')) {
        return envUrl.replace('127.0.0.1', 'localhost');
      }
    }
    return envUrl;
  }
  return '/api';
};

const API_URL = resolveApiUrl();

const getBaseOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const getHeaders = (isFormData = false) => {
  const token = localStorage.getItem('edl_token');
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  async get(endpoint, params = {}) {
    const url = new URL(`${API_URL}${endpoint}`, getBaseOrigin());
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url.searchParams.append(key, params[key]);
      }
    });

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: getHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new ApiError(data.message || `Request failed with status ${res.status}`, res.status, data);
      err.retryAfter = res.headers ? res.headers.get('Retry-After') : null;
      throw err;
    }
    return data;
  },

  async post(endpoint, body = {}, isFormData = false) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(isFormData),
      body: isFormData ? body : JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new ApiError(data.message || `Request failed with status ${res.status}`, res.status, data);
      err.retryAfter = res.headers ? res.headers.get('Retry-After') : null;
      throw err;
    }
    return data;
  },

  async put(endpoint, body = {}, isFormData = false) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(isFormData),
      body: isFormData ? body : JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new ApiError(data.message || `Request failed with status ${res.status}`, res.status, data);
      err.retryAfter = res.headers ? res.headers.get('Retry-After') : null;
      throw err;
    }
    return data;
  },

  async patch(endpoint, body = {}) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new ApiError(data.message || `Request failed with status ${res.status}`, res.status, data);
      err.retryAfter = res.headers ? res.headers.get('Retry-After') : null;
      throw err;
    }
    return data;
  },

  async delete(endpoint, params = {}) {
    const url = new URL(`${API_URL}${endpoint}`, getBaseOrigin());
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: getHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new ApiError(data.message || `Request failed with status ${res.status}`, res.status, data);
      err.retryAfter = res.headers ? res.headers.get('Retry-After') : null;
      throw err;
    }
    return data;
  }
};
