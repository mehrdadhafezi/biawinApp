import { createHomeResourceApi } from "./home-resource-api";
import type { HomeServiceBannerAdmin, HomeServiceBannerInput } from "../types";

/** `/admin/home/service-banners/**` (backend/src/modules/home/home-service-banners-admin.controller.ts). */
export const homeServiceBannerApi = createHomeResourceApi<HomeServiceBannerAdmin, HomeServiceBannerInput>(
  "/admin/home/service-banners",
);
