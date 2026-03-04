export interface Feed {
  title: string;
  description: string;
  link: string;
  author: string;
  published: string;
  image?: string;
  entries: FeedEntry[];
}

export interface FeedEntry {
  id: string;
  title: string;
  link: string;
  author: string;
  published: string;
  updated?: string;
  description: string;
  thumbnail?: string;
  content?: string;
}
