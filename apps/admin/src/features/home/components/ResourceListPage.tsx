"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, color, font } from "@biawin/ui";
import { ActiveToggle } from "./ActiveToggle";
import { ReorderControls } from "./ReorderControls";
import { ConfirmDialog } from "./ConfirmDialog";

export interface ResourceListColumn<T> {
  header: string;
  render: (item: T) => ReactNode;
}

export interface ResourceListPageProps<T> {
  title: string;
  description: string;
  newHref: string;
  newLabel: string;
  canManage: boolean;
  items: T[] | null;
  loadError: string | null;
  actionError: string | null;
  successMessage: string | null;
  getId: (item: T) => string;
  getActive: (item: T) => boolean;
  getThumbnail: (item: T) => string | null;
  getTitle: (item: T) => string;
  columns: ResourceListColumn<T>[];
  editHref: (item: T) => string;
  onToggleActive: (item: T) => void;
  togglingId: string | null;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  reorderBusy: boolean;
  onDelete: (item: T) => void;
  deleteTarget: T | null;
  deleteBusy: boolean;
  deleteError: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deleteDescriptionFor: (item: T) => string;
  emptyLabel: string;
}

/**
 * The shared list-page scaffold reused by all 4 Home resources (hero
 * cards, service banners, service mosaic tiles, news articles) — each
 * resource still calls its own dedicated API module and owns its own data
 * fetching/mutation state; only the table rendering + reorder/toggle/
 * delete chrome is shared, matching "reusable form components/patterns
 * where appropriate" from Stage 5.20's brief. This is a UI convenience,
 * not a generic-CRUD backend abstraction — see `home-resource-api.ts`.
 */
export function ResourceListPage<T>({
  title,
  description,
  newHref,
  newLabel,
  canManage,
  items,
  loadError,
  actionError,
  successMessage,
  getId,
  getActive,
  getThumbnail,
  getTitle,
  columns,
  editHref,
  onToggleActive,
  togglingId,
  onMoveUp,
  onMoveDown,
  reorderBusy,
  onDelete,
  deleteTarget,
  deleteBusy,
  deleteError,
  onConfirmDelete,
  onCancelDelete,
  deleteDescriptionFor,
  emptyLabel,
}: ResourceListPageProps<T>) {
  return (
    <div style={{ fontFamily: font.family }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>{title}</h1>
          <p style={{ marginTop: 8, fontSize: 13, color: color.muted }}>{description}</p>
        </div>
        {canManage && (
          <Link href={newHref}>
            <Button type="button">{newLabel}</Button>
          </Link>
        )}
      </div>

      {successMessage && (
        <p role="status" className="biawin-home-list-success">
          {successMessage}
        </p>
      )}
      {loadError && (
        <p role="alert" className="biawin-home-list-error">
          {loadError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="biawin-home-list-error">
          {actionError}
        </p>
      )}

      {items === null && !loadError ? (
        <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>
      ) : items && items.length === 0 ? (
        <p style={{ fontSize: 13, color: color.muted }}>{emptyLabel}</p>
      ) : items ? (
        <div className="biawin-home-list-table-wrap">
          <table className="biawin-home-list-table">
            <thead>
              <tr>
                <th></th>
                <th>عنوان</th>
                {columns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
                <th>وضعیت</th>
                {canManage && <th>ترتیب</th>}
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const id = getId(item);
                const thumbnail = getThumbnail(item);
                return (
                  <tr key={id}>
                    <td>
                      <div className="biawin-home-list-thumb">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>
                    <td className="biawin-home-list-title">
                      {canManage ? <Link href={editHref(item)}>{getTitle(item)}</Link> : getTitle(item)}
                    </td>
                    {columns.map((column) => (
                      <td key={column.header}>{column.render(item)}</td>
                    ))}
                    <td>
                      <ActiveToggle
                        active={getActive(item)}
                        disabled={!canManage}
                        busy={togglingId === id}
                        onToggle={() => onToggleActive(item)}
                      />
                    </td>
                    {canManage && (
                      <td>
                        <ReorderControls
                          busy={reorderBusy}
                          disabledUp={index === 0}
                          disabledDown={index === items.length - 1}
                          onMoveUp={() => onMoveUp(index)}
                          onMoveDown={() => onMoveDown(index)}
                        />
                      </td>
                    )}
                    {canManage && (
                      <td>
                        <button type="button" className="biawin-home-list-delete" onClick={() => onDelete(item)}>
                          حذف
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {deleteTarget && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="حذف مورد"
          description={deleteDescriptionFor(deleteTarget)}
          busy={deleteBusy}
          errorMessage={deleteError}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}

      <style>{`
        .biawin-home-list-success{font-size:12px;font-weight:700;color:#1f9d55;background:#e6f7ee;border-radius:10px;padding:10px 14px;margin:0 0 16px}
        .biawin-home-list-error{font-size:12px;font-weight:700;color:#c0392b;background:#fdf1f0;border-radius:10px;padding:10px 14px;margin:0 0 16px}
        .biawin-home-list-table-wrap{overflow-x:auto;background:${color.white};border:1px solid ${color.line};border-radius:16px}
        .biawin-home-list-table{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}
        .biawin-home-list-table th{text-align:right;font-size:11px;font-weight:800;color:${color.muted};padding:12px 14px;border-bottom:1px solid ${color.line};white-space:nowrap}
        .biawin-home-list-table td{padding:10px 14px;border-bottom:1px solid ${color.line};color:${color.ink};vertical-align:middle}
        .biawin-home-list-table tr:last-child td{border-bottom:none}
        .biawin-home-list-title a{color:${color.primary};font-weight:700;text-decoration:none}
        .biawin-home-list-title a:hover{text-decoration:underline}
        .biawin-home-list-thumb{width:44px;height:44px;border-radius:10px;background:${color.ice};display:flex;align-items:center;justify-content:center;overflow:hidden;color:${color.muted};font-size:11px}
        .biawin-home-list-thumb img{width:100%;height:100%;object-fit:cover}
        .biawin-home-list-delete{border:1px solid ${color.line};background:${color.white};color:#c0392b;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
        .biawin-home-list-delete:hover{background:#fdf1f0}
      `}</style>
    </div>
  );
}
