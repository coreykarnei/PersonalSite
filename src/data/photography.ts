import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/photography/*.{jpg,JPG,jpeg,JPEG,png,PNG}',
  { eager: true },
);

export type PhotoMeta = {
  region: string;
  location?: string;
  year?: number;
  caption?: string;
};

const DEFAULT_REGION = 'Recent';

/**
 * Edit this map as you add or label photos. Key is the filename (no path).
 * Photos with no entry fall under DEFAULT_REGION and render at the end.
 *
 * Region order in the gallery is determined by REGION_ORDER below.
 */
const photoMetadata: Record<string, PhotoMeta> = {
  // 'p3.PNG': { region: 'Alps', location: 'Chamonix', year: 2023 },
  // 'p4.JPG': { region: 'Cinque Terre', location: 'Manarola', year: 2023 },
};

/** Order regions appear in the gallery. Unlisted regions append alphabetically. */
const REGION_ORDER = ['Alps', 'Cinque Terre', 'Stateside', 'Recent'];

export type Photo = PhotoMeta & {
  filename: string;
  src: ImageMetadata;
};

const all: Photo[] = Object.entries(modules).map(([path, mod]) => {
  const filename = path.split('/').pop()!;
  const meta = photoMetadata[filename] ?? { region: DEFAULT_REGION };
  return { filename, src: mod.default, ...meta };
});

export type PhotoGroup = {
  region: string;
  photos: Photo[];
};

const grouped = new Map<string, Photo[]>();
for (const photo of all) {
  const list = grouped.get(photo.region) ?? [];
  list.push(photo);
  grouped.set(photo.region, list);
}

const orderIndex = (region: string) => {
  const i = REGION_ORDER.indexOf(region);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

export const photoGroups: PhotoGroup[] = Array.from(grouped.entries())
  .map(([region, photos]) => ({ region, photos }))
  .sort((a, b) => {
    const ai = orderIndex(a.region);
    const bi = orderIndex(b.region);
    if (ai !== bi) return ai - bi;
    return a.region.localeCompare(b.region);
  });

export const totalPhotos = all.length;
