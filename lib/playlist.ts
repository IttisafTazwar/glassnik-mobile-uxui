// The list of videos a visitor was browsing when they opened the large
// viewer (a Category, Place, Destination or search results page). The
// viewer plays this list, starting from the video that was clicked.
// It lives in memory only; after a page reload the viewer falls back to
// the full feed.
let playlistIds: string[] = [];

export function setPlaylist(ids: string[]) {
  playlistIds = ids;
}

export function getPlaylist(): string[] {
  return playlistIds;
}