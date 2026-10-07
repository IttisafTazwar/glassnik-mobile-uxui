// Shared helpers for grouping and linking Destinations and Places.
// Explore, the video cards and the feed all use these, so a link from any
// screen produces the same key as the matching pill on the Explore page.

export function normaliseKey(value?: string | null): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Known misspellings of a city. A stopgap: the lasting fix is a standard
// location list on the upload form (or correcting the saved data).
const CITY_CORRECTIONS: Record<string, string> = {
  'kuala lumper': 'Kuala Lumpur',
};

export function correctCity(city?: string | null): string | undefined {
  if (!city) return undefined;
  return CITY_CORRECTIONS[normaliseKey(city)] ?? city;
}

export function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// The key that identifies a destination. Some videos store the whole location
// in `city` ("Kuala Lumpur, Malaysia") with no separate country, so a trailing
// country part is dropped in that case.
export function destinationKeyFor(
  city?: string | null,
  country?: string | null,
): string {
  let name = (city ?? '').trim();
  const countryName = (country ?? '').trim();

  if (!countryName && name.includes(',')) {
    const parts = name
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    name = parts.length > 1 ? parts.slice(0, -1).join(', ') : parts[0] ?? '';
  }

  const corrected = correctCity(name) ?? name;
  return normaliseKey(corrected) || normaliseKey(countryName);
}