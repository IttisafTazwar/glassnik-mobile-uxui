export interface SampleVideo {
  id: string;
  uri: string;
  /** Thumbnail URL — present for API-sourced videos that have been processed. */
  thumbnailUrl?: string;
  /** Numeric user ID of the creator — present only for API-sourced videos. */
  creatorId?: number;
  creator: {
    name: string;
    username: string;
    initial: string;
    color: string;
    /** Profile photo URL — present for API-sourced videos when the creator has uploaded one. */
    avatarUrl?: string;
  };
  description: string;
  hashtags: string[];
  music: string;
  likes: number;
  comments: number;
  shares: number;
  /** Location fields — present for API-sourced videos when the creator filled them in. */
  place?: string | null;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  /**
   * Upload timestamp — present only for API-sourced videos (mapped from
   * VideoAsset.createdAt). Static sample/placeholder videos below have no
   * real upload date, so this is left undefined for them; the Explore
   * screen sorts videos with a createdAt first (newest → oldest) and
   * places undated sample videos after all of them.
   */
  createdAt?: string;
}

export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: 'sv-1',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    creator: { name: 'Luna Chen', username: 'lunachen', initial: 'L', color: '#FF6B9D' },
    description: 'When life calls, you answer with adventure 🌊✨ Some moments are worth chasing forever',
    hashtags: ['adventure', 'explore', 'travel'],
    music: 'Adventure Time – Indie Mix',
    likes: 284312,
    comments: 8921,
    shares: 12840,
  },
  {
    id: 'sv-2',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    creator: { name: 'Marcus Fire', username: 'marcusfire', initial: 'M', color: '#FF4500' },
    description: 'Feel the heat 🔥 This is what real passion looks like. No cap.',
    hashtags: ['fire', 'intense', 'viral'],
    music: 'Blaze It – Underground Beats',
    likes: 512849,
    comments: 15234,
    shares: 34521,
  },
  {
    id: 'sv-3',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    creator: { name: 'Pixel Dreams', username: 'pixeldreams', initial: 'P', color: '#7C3AED' },
    description: 'In a world full of chaos, be the bunny 🐰 POV: main character energy all day',
    hashtags: ['animation', 'cgi', 'vibes'],
    music: 'Dream State – Lo-fi Collective',
    likes: 943201,
    comments: 29182,
    shares: 87234,
  },
  {
    id: 'sv-4',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    creator: { name: 'Sci-Fi Sofia', username: 'scifisofia', initial: 'S', color: '#0EA5E9' },
    description: 'The future is closer than you think 🚀 Open source art is changing everything',
    hashtags: ['scifi', 'futuristic', 'art'],
    music: 'Electric Dreams – Synth Wave',
    likes: 376419,
    comments: 11043,
    shares: 28931,
  },
  {
    id: 'sv-5',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    creator: { name: 'Joy Unlimited', username: 'joyunlimited', initial: 'J', color: '#F59E0B' },
    description: 'Life is literally too short not to have fun every single day 🎉 Join me!',
    hashtags: ['fun', 'lifestyle', 'happy'],
    music: 'Good Times – Summer Hits',
    likes: 1204831,
    comments: 42319,
    shares: 156293,
  },
  {
    id: 'sv-6',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    creator: { name: 'Drift King', username: 'driftking', initial: 'D', color: '#EF4444' },
    description: 'Not all those who wander are lost — some are finding the best routes 🚗💨',
    hashtags: ['cars', 'drift', 'speed'],
    music: 'Highway Star – Rock Legend',
    likes: 782341,
    comments: 23891,
    shares: 94012,
  },
  {
    id: 'sv-7',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    creator: { name: 'Adrenaline Alex', username: 'adrenalinealex', initial: 'A', color: '#10B981' },
    description: 'Running with bulls in Pamplona 🐂 Would you do it? Drop 🔥 or 💀 below',
    hashtags: ['extreme', 'bullrun', 'spain'],
    music: 'Danger Zone – Top Hits',
    likes: 2314982,
    comments: 89231,
    shares: 432910,
  },
  {
    id: 'sv-8',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    creator: { name: 'Cinema Zero', username: 'cinemazero', initial: 'C', color: '#6366F1' },
    description: 'Open source film that changed everything 🎬 Art belongs to everyone, always',
    hashtags: ['film', 'cinematic', 'blender'],
    music: 'Tears of Steel OST – Score',
    likes: 891234,
    comments: 34291,
    shares: 112840,
  },
];