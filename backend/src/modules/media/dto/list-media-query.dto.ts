import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** No extra filters yet (folder/tag/mimeType) — extended once a real consumer needs them. */
export class ListMediaQueryDto extends PaginationQueryDto {}
