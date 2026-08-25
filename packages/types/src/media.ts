import type { ID, ISODateString } from "./common";

/** Matches the shape returned by every `/admin/media/**` endpoint (Stage 5.18). */
export interface MediaAsset {
  id: ID;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  uploadedBy: ID | null;
  createdAt: ISODateString;
}
