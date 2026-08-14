import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:3000';

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

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, displayName?: string, username?: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, username }),
    }),

  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: async () => {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) return;
    return request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  },
};

// ─── Mobile feed & upload ──────────────────────────────────────────────────────
export const mobileApi = {
  getFeed: (page = 1, limit = 20) =>
    request<any[]>(`/mobile/feed?page=${page}&limit=${limit}`),

 /** Request a Google Cloud Storage signed upload URL from the backend. */
  requestUpload: (
  title: string,
  fileSize: number,
  description?: string,
) =>
  request<{ id: number; uploadUrl: string }>(
    '/videos/request-upload',
    {
      method: 'POST',
      body: JSON.stringify({
  title,
  fileSize,
  description,
  source: 'MOBILE',
}),
    },
  ),

  completeUpload: (videoId: number) =>
  request(`/videos/${videoId}/complete`, {
    method: 'POST',
  }),

  /** Poll Cloudflare processing status for a video. */
  checkStatus: (videoId: number) =>
    request<{ status: string; publicUrl?: string; thumbnailUrl?: string; errorMessage?: string }>(
      `/videos/${videoId}/status`,
    ),
};

// ─── User / capabilities / profile ────────────────────────────────────────────
export const userApi = {
  getMyCapabilities: () => request<any[]>('/me/capabilities'),

  getMe: () => request<any>('/users/me'),

  updateMe: (data: { displayName?: string; username?: string; avatarUrl?: string }) =>
    request<any>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getUser: (id: number) =>
    request<any>(`/users/${id}`),

  follow: (userId: number) =>
    request<{ following: boolean; followerCount: number }>(`/users/${userId}/follow`, {
      method: 'POST',
    }),

  unfollow: (userId: number) =>
    request<{ following: boolean; followerCount: number }>(`/users/${userId}/follow`, {
      method: 'DELETE',
    }),
};

// ─── Videos ───────────────────────────────────────────────────────────────────
export const videoApi = {
  /** Fetch a single video by ID. */
  getVideo: (id: number) =>
    request<any>(`/videos/${id}`),

  /** Returns videos for a user. Owner sees all statuses; others see published only. */
  getUserVideos: (userId: number, page = 1, limit = 50) =>
    request<any>(`/users/${userId}/videos?page=${page}&limit=${limit}`),

  deleteVideo: (id: number) =>
    request<{ success: boolean }>(`/videos/${id}`, { method: 'DELETE' }),

  getComments: (videoId: string | number, page = 1, limit = 50) =>
    request<any>(`/videos/${videoId}/comments?page=${page}&limit=${limit}`),

  postComment: (videoId: string | number, text: string) =>
    request<any>(`/videos/${videoId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  likeVideo: (videoId: string | number) =>
    request<{ liked: boolean; likeCount: number }>(`/videos/${videoId}/like`, {
      method: 'POST',
    }),

  unlikeVideo: (videoId: string | number) =>
    request<{ liked: boolean; likeCount: number }>(`/videos/${videoId}/like`, {
      method: 'DELETE',
    }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  getNotifications: async (): Promise<import('@/types').Notification[]> => {
    const raw = await request<unknown>('/notifications');
    // Normalize: server may return [] or { notifications: [] } or { data: [] }
    if (Array.isArray(raw)) return raw as import('@/types').Notification[];
    const obj = raw as Record<string, unknown>;
    return ((obj?.notifications ?? obj?.data ?? []) as import('@/types').Notification[]);
  },

  getUnreadCount: () => request<{ count: number }>('/notifications/unread-count'),

  markAllRead: () =>
    request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),

  markRead: (id: number) =>
    request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
};
