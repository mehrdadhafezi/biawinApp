import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** No extra filters yet — extended (resourceType, action, date range) once a real admin UI needs them. */
export class ListAdminAuditLogQueryDto extends PaginationQueryDto {}
