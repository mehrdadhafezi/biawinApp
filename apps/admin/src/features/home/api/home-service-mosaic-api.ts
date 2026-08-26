import { createHomeResourceApi } from "./home-resource-api";
import type { HomeServiceMosaicTileAdmin, HomeServiceMosaicTileInput } from "../types";

/** `/admin/home/service-mosaic-tiles/**` (backend/src/modules/home/home-service-mosaic-tiles-admin.controller.ts). */
export const homeServiceMosaicApi = createHomeResourceApi<HomeServiceMosaicTileAdmin, HomeServiceMosaicTileInput>(
  "/admin/home/service-mosaic-tiles",
);
