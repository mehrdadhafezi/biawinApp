import { createHomeResourceApi } from "./home-resource-api";
import type { HomeNewsArticleAdmin, HomeNewsArticleInput } from "../types";

/** `/admin/home/news-articles/**` (backend/src/modules/home/home-news-articles-admin.controller.ts). */
export const homeNewsApi = createHomeResourceApi<HomeNewsArticleAdmin, HomeNewsArticleInput>(
  "/admin/home/news-articles",
);
