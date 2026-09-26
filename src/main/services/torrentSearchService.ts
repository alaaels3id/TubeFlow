import { TorrentCategory, TorrentSearchResult } from '../../shared/types';
import { loggerService } from './loggerService';

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorn-tracker.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969',
  'udp://open.demonii.com:1337/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.coppersurfer.tk:6969'
];

const YTS_BASE_URLS = [
  'https://movies-api.accel.li/api/v2',
  'https://yts.gg/api/v2',
  'https://yts.bz/api/v2'
];

export class TorrentSearchService {
  private formatSize(bytes: number): string {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
  }

  private mapCategory(catId: string): { label: string; group: TorrentCategory } {
    const id = parseInt(catId, 10);
    if (id >= 100 && id < 200) {
      return { label: 'Audio / Music', group: 'music' };
    }
    if (id >= 200 && id < 300) {
      if (id === 201 || id === 207 || id === 202) return { label: 'Movie', group: 'movies' };
      if (id === 205 || id === 208) return { label: 'TV Show', group: 'movies' };
      return { label: 'Video', group: 'movies' };
    }
    if (id >= 300 && id < 400) {
      if (id === 301) return { label: 'Windows App', group: 'apps' };
      if (id === 302) return { label: 'Mac App', group: 'apps' };
      if (id === 303) return { label: 'UNIX App', group: 'apps' };
      return { label: 'Application', group: 'apps' };
    }
    if (id >= 400 && id < 500) {
      if (id === 401) return { label: 'PC Game', group: 'games' };
      return { label: 'Game', group: 'games' };
    }
    return { label: 'Other', group: 'other' };
  }

  public createMagnetUri(infoHash: string, name: string): string {
    const dn = encodeURIComponent(name);
    const trackers = DEFAULT_TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
    return `magnet:?xt=urn:btih:${infoHash.toLowerCase()}&dn=${dn}${trackers}`;
  }

  public async searchApibay(query: string, category: string = 'all'): Promise<TorrentSearchResult[]> {
    let catParam = '';
    if (category === 'movies') catParam = '200';
    else if (category === 'apps') catParam = '300';
    else if (category === 'games') catParam = '400';
    else if (category === 'music') catParam = '100';

    const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=${catParam}`;

    try {
      loggerService.info('TORRENT_SEARCH', `Searching apibay for "${query}" with category "${category}"`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Apibay returned status ${res.status}`);
      }

      const data = (await res.json()) as any[];
      if (!Array.isArray(data)) {
        return [];
      }

      if (data.length === 1 && (data[0].name === 'No results returned' || data[0].id === '0')) {
        return [];
      }

      const results: TorrentSearchResult[] = data
        .filter((item) => item.info_hash && item.name && item.id !== '0')
        .map((item) => {
          const size = parseInt(item.size, 10) || 0;
          const seeders = parseInt(item.seeders, 10) || 0;
          const leechers = parseInt(item.leechers, 10) || 0;
          const { label, group } = this.mapCategory(item.category);
          const magnet = this.createMagnetUri(item.info_hash, item.name);

          return {
            id: `tp-${item.id || item.info_hash}`,
            name: item.name,
            infoHash: item.info_hash.toLowerCase(),
            magnet,
            size,
            formattedSize: this.formatSize(size),
            seeders,
            leechers,
            category: label,
            categoryGroup: group,
            added: item.added ? new Date(parseInt(item.added, 10) * 1000).toLocaleDateString() : undefined,
            imdb: item.imdb || undefined,
            source: 'ThePirateBay'
          };
        });

      return results;
    } catch (err: any) {
      loggerService.error('TORRENT_SEARCH', `Error searching apibay: ${err.message}`);
      return [];
    }
  }

  public async searchYTS(query: string): Promise<TorrentSearchResult[]> {
    loggerService.info('TORRENT_SEARCH', `Searching YTS for "${query}"`);

    for (const baseUrl of YTS_BASE_URLS) {
      try {
        const url = `${baseUrl}/list_movies.json?query_term=${encodeURIComponent(query)}&limit=20&sort_by=seeds`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)'
          }
        });
        clearTimeout(timeout);

        if (!res.ok) {
          continue;
        }

        const json = await res.json();
        if (json?.status !== 'ok' || !json?.data?.movies || !Array.isArray(json.data.movies)) {
          return [];
        }

        const results: TorrentSearchResult[] = [];

        for (const movie of json.data.movies) {
          if (!movie.torrents || !Array.isArray(movie.torrents)) continue;

          for (const tor of movie.torrents) {
            if (!tor.hash) continue;
            const size = tor.size_bytes || 0;
            const qualityTag = tor.quality ? tor.quality.toUpperCase() : '';
            const typeTag = tor.type ? tor.type.toUpperCase() : '';
            const tagStr = [qualityTag, typeTag].filter(Boolean).join(' ');
            const movieTitle = movie.title_long || movie.title || 'Movie';
            const fullName = tagStr ? `${movieTitle} [${tagStr}] [YTS]` : `${movieTitle} [YTS]`;

            const magnet = this.createMagnetUri(tor.hash, fullName);

            results.push({
              id: `yts-${movie.id}-${tor.hash}`,
              name: fullName,
              infoHash: tor.hash.toLowerCase(),
              magnet,
              size,
              formattedSize: tor.size || this.formatSize(size),
              seeders: parseInt(tor.seeds, 10) || 0,
              leechers: parseInt(tor.peers, 10) || 0,
              category: 'Movie',
              categoryGroup: 'movies',
              source: 'YTS (YIFY)',
              added: tor.date_uploaded ? new Date(tor.date_uploaded).toLocaleDateString() : undefined,
              imdb: movie.imdb_code || undefined,
              poster: movie.medium_cover_image || movie.small_cover_image || undefined,
              rating: typeof movie.rating === 'number' && movie.rating > 0 ? movie.rating : undefined,
              year: movie.year || undefined,
              quality: tor.quality || undefined,
              genres: movie.genres || []
            });
          }
        }

        return results;
      } catch (e: any) {
        loggerService.warn('TORRENT_SEARCH', `YTS mirror ${baseUrl} failed: ${e?.message || e}`);
      }
    }

    return [];
  }

  public async search(query: string, category: string = 'all', provider: string = 'all'): Promise<TorrentSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Direct Magnet Link detection
    if (trimmed.startsWith('magnet:?')) {
      const match = trimmed.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      const nameMatch = trimmed.match(/dn=([^&]+)/i);
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Direct Magnet Torrent';
      const infoHash = match ? match[1].toLowerCase() : 'direct';
      return [
        {
          id: `direct-${Date.now()}`,
          name,
          infoHash,
          magnet: trimmed,
          size: 0,
          formattedSize: 'Unknown',
          seeders: 1,
          leechers: 0,
          category: 'Direct Magnet',
          categoryGroup: 'other',
          source: 'Direct'
        }
      ];
    }

    // Direct 40-char InfoHash detection
    if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
      const infoHash = trimmed.toLowerCase();
      const magnet = this.createMagnetUri(infoHash, `Torrent-${infoHash.slice(0, 8)}`);
      return [
        {
          id: `hash-${infoHash}`,
          name: `Torrent ${infoHash.slice(0, 8)}`,
          infoHash,
          magnet,
          size: 0,
          formattedSize: 'Unknown',
          seeders: 1,
          leechers: 0,
          category: 'Direct InfoHash',
          categoryGroup: 'other',
          source: 'Direct'
        }
      ];
    }

    // Provider Routing
    if (provider === 'yts') {
      return await this.searchYTS(trimmed);
    }

    if (provider === 'thepiratebay') {
      return await this.searchApibay(trimmed, category);
    }

    // Default 'all': Search both if movie-related or all
    if (category === 'movies' || category === 'all') {
      const [apibayRes, ytsRes] = await Promise.allSettled([
        this.searchApibay(trimmed, category),
        this.searchYTS(trimmed)
      ]);

      const ytsList = ytsRes.status === 'fulfilled' ? ytsRes.value : [];
      const apibayList = apibayRes.status === 'fulfilled' ? apibayRes.value : [];

      // Combine YTS first (usually higher quality / seeded), then Apibay
      const combined = [...ytsList, ...apibayList];
      const seen = new Set<string>();
      const deduped: TorrentSearchResult[] = [];

      for (const item of combined) {
        if (!seen.has(item.infoHash)) {
          seen.add(item.infoHash);
          deduped.push(item);
        }
      }

      return deduped;
    }

    // For non-movie categories (apps, games, music), apibay is the only applicable provider
    return await this.searchApibay(trimmed, category);
  }
}

export const torrentSearchService = new TorrentSearchService();
