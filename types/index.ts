export interface User {
  id: number;
  email: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface VideoAsset {
  id: number;
  title?: string | null;
  description?: string | null;
  publicUrl?: string | null;
  thumbnailUrl?: string | null;
  gcsPath?: string | null;
  source?: string | null;
  status?: string | null;
  mimeType?: string | null;
  duration?: number | null;
  likes?: number | null;
  createdAt: string;
  owner?: {
    id: number;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  place?: string | null;
  city?: string | null;
  country?: string | null;
  category?: string | null;
}

export interface VideoItem {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  publicUrl?: string | null;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface FeedResponse {
  data: VideoAsset[];
  total?: number;
}

export interface Capability {
  id: number;
  status: string;
  expiresAt?: string | null;
  capability: {
    name: string;
    iconUrl?: string | null;
    badgeType?: string | null;
  };
}

export interface Comment {
  id: number;
  text: string;
  createdAt: string;
  author?: {
    id: number;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface Notification {
  id: number;
  type: 'like' | 'comment' | 'follow' | string;
  read: boolean;
  createdAt: string;
  actor?: {
    id: number;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  videoId?: number | null;
  commentId?: number | null;
  videoTitle?: string | null;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}
