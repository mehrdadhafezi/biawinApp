import { createHomeResourceApi } from "./home-resource-api";
import type { HomeHeroCardAdmin, HomeHeroCardInput } from "../types";

/** `/admin/home/hero-cards/**` (backend/src/modules/home/home-hero-cards-admin.controller.ts). */
export const homeHeroApi = createHomeResourceApi<HomeHeroCardAdmin, HomeHeroCardInput>("/admin/home/hero-cards");
