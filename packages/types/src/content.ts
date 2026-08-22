import type { ID, Timestamps } from "./common";

export interface NewsArticle extends Timestamps {
  id: ID;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  category: string;
  featured: boolean;
  publishedAt: string;
}
