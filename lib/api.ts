import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://glassnik-backend-798114647130.australia-southeast1.run.app';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('accessToken');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      const items: [string, string][] = [['accessToken', data.accessToken]];
      if (data.refreshToken) items.push(['refreshToken', data.refreshToken]);
      await AsyncStorage.multiSet(items);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Unable to reach the server. Check your connection.');
  }

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, false);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, displayName?: string, username?: string) =>
    request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, username }),
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),
};

export const userApi = {
  getMe: () => request<any>('/users/me'),

  updateMe: (data: { displayName?: string; username?: string; avatarUrl?: string }) =>
    request<any>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getMyCapabilities: () => request<any[]>('/users/me/capabilities'),

  follow: (userId: number) =>
    request<void>(`/users/${userId}/follow`, { method: 'POST' }),

  unfollow: (userId: number) =>
    request<void>(`/users/${userId}/follow`, { method: 'DELETE' }),
};

export const videoApi = {
  getUserVideos: (userId: number) =>
    request<any>(`/users/${userId}/videos`),

  deleteVideo: (videoId: number) =>
    request<void>(`/videos/${videoId}`, { method: 'DELETE' }),

  likeVideo: (videoId: number) =>
    request<void>(`/videos/${videoId}/like`, { method: 'POST' }),

  unlikeVideo: (videoId: number) =>
    request<void>(`/videos/${videoId}/like`, { method: 'DELETE' }),
};

export const mobileApi = {
  getFeed: (page: number, limit: number) =>
    request<any[]>(`/feed?page=${page}&limit=${limit}`),

  requestUpload: (title: string, fileSize: number, description?: string) =>
    request<any>('/videos/upload-request', {
      method: 'POST',
      body: JSON.stringify({ title, fileSize, description }),
    }),

  completeUpload: (videoId: number) =>
    request<void>(`/videos/${videoId}/complete`, { method: 'POST' }),

  checkStatus: (videoId: number) =>
    request<any>(`/videos/${videoId}/status`),
};

// ── Moderation ──────────────────────────────────────────────────────────
// New — supports the moderator/admin page. Follows the same request<T>()
// pattern as every other API group above. Requires the logged-in user to
// have MODERATOR or ADMIN role (enforced server-side); the frontend page
// this powers should also gate access based on the user's role once that
// field is confirmed on the User type.
export const moderationApi = {
  getQueue: (filters?: { status?: string; assignedToId?: number; minPriority?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.assignedToId != null) params.set('assignedToId', String(filters.assignedToId));
    if (filters?.minPriority != null) params.set('minPriority', String(filters.minPriority));
    const qs = params.toString();
    return request<any>(`/moderation/queue${qs ? `?${qs}` : ''}`);
  },

  assignToQueue: (queueItemId: number, assignedToId?: number) =>
    request<any>(`/moderation/queue/${queueItemId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(assignedToId != null ? { assignedToId } : {}),
    }),

  submitAction: (opts: {
    videoId: number;
    action: 'APPROVE' | 'REJECT' | 'REMOVE' | 'SHADOW_BAN' | 'AGE_RESTRICT';
    reason?: string;
    policyVersion?: string;
    queueItemId?: number;
  }) =>
    request<any>('/moderation/actions', {
      method: 'POST',
      body: JSON.stringify(opts),
    }),
};