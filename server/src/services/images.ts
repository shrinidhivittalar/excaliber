import axios from "axios";

export interface ImageResult {
  url: string;
  alt: string;
  width: number;
  height: number;
}

interface CacheEntry {
  results: ImageResult[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

interface PexelsPhoto {
  alt: string;
  width: number;
  height: number;
  src: { large: string };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

export async function searchImages(
  query: string,
  count: number = 3
): Promise<ImageResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const limit = Math.min(Math.max(count, 1), 3);
  const cacheKey = `${trimmed.toLowerCase()}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const { data } = await axios.get<PexelsSearchResponse>(
      "https://api.pexels.com/v1/search",
      {
        params: { query: trimmed, per_page: limit },
        headers: { Authorization: apiKey },
        timeout: 10000,
      }
    );

    const results: ImageResult[] = (data.photos ?? []).map((photo) => ({
      url: photo.src.large,
      alt: photo.alt ?? trimmed,
      width: photo.width,
      height: photo.height,
    }));

    cache.set(cacheKey, {
      results,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return results;
  } catch {
    return [];
  }
}
