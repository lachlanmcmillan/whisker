export interface Feed {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  published: string;
  image?: string;
  fetchedAt?: string;
  entries: FeedEntry[];
}

export interface FeedEntry {
  entryId: string;
  title: string;
  link: string;
  author: string;
  published: string;
  updated?: string;
  description: string;
  thumbnail?: string;
  content?: string;
}
