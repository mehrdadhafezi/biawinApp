"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, color, font } from "@biawin/ui";
import { ReorderControls } from "../../home/components/ReorderControls";

export interface CatalogListColumn<T> {
  header: string;
  render: (item: T) => ReactNode;
}

export interface CatalogListTableProps<T> {
  title: string;
  description: string;
  newHref: string;
  newLabel: string;
  canManage: boolean;
  items: T[] | null;
  loadError: string | null;
  actionError: string | null;
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  columns: CatalogListColumn<T>[];
  /** Renders the resource's own status control (boolean toggle, or a multi-state select). */
  renderStatus: (item: T) => ReactNode;
  editHref: (item: T) => string;
  /** Omit to hide the ordering column entirely (e.g. Service/CardProduct, which aren't reordered in this stage). */
  reorder?: {
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    busy: boolean;
  };
  emptyLabel: string;
}

/**
 * SERVICES-R5.17 — the Category/Service/CardProduct analog of
 * features/home/components/ResourceListPage.tsx, deliberately NOT a reuse
 * of that exact component: no resource in this stage has a delete
 * capability (not requested by the task, and Category/Service/CardProduct
 * all have real FK-restricted dependents), and CardProduct's 4-state
 * status can't be expressed by ResourceListPage's hardcoded boolean
 * ActiveToggle — so `renderStatus` is a slot instead. `ReorderControls` is
 * reused directly (fully generic already).
 */
export function CatalogListTable<T>({
  title,
  description,
  newHref,
  newLabel,
  canManage,
  items,
  loadError,
  actionError,
  getId,
  getTitle,
  columns,
  renderStatus,
  editHref,
  reorder,
  emptyLabel,
}: CatalogListTableProps<T>) {
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

      {loadError && (
        <p role="alert" className="biawin-catalog-list-error">
          {loadError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="biawin-catalog-list-error">
          {actionError}
        </p>
      )}

      {items === null && !loadError ? (
        <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>
      ) : items && items.length === 0 ? (
        <p style={{ fontSize: 13, color: color.muted }}>{emptyLabel}</p>
      ) : items ? (
        <div className="biawin-catalog-list-table-wrap">
          <table className="biawin-catalog-list-table">
            <thead>
              <tr>
                <th>عنوان</th>
                {columns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
                <th>وضعیت</th>
                {reorder && canManage && <th>ترتیب</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const id = getId(item);
                return (
                  <tr key={id}>
                    <td className="biawin-catalog-list-title">
                      {canManage ? <Link href={editHref(item)}>{getTitle(item)}</Link> : getTitle(item)}
                    </td>
                    {columns.map((column) => (
                      <td key={column.header}>{column.render(item)}</td>
                    ))}
                    <td>{renderStatus(item)}</td>
                    {reorder && canManage && (
                      <td>
                        <ReorderControls
                          busy={reorder.busy}
                          disabledUp={index === 0}
                          disabledDown={index === items.length - 1}
                          onMoveUp={() => reorder.onMoveUp(index)}
                          onMoveDown={() => reorder.onMoveDown(index)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <style>{`
        .biawin-catalog-list-error{font-size:12px;font-weight:700;color:#c0392b;background:#fdf1f0;border-radius:10px;padding:10px 14px;margin:0 0 16px}
        .biawin-catalog-list-table-wrap{overflow-x:auto;background:${color.white};border:1px solid ${color.line};border-radius:16px}
        .biawin-catalog-list-table{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}
        .biawin-catalog-list-table th{text-align:right;font-size:11px;font-weight:800;color:${color.muted};padding:12px 14px;border-bottom:1px solid ${color.line};white-space:nowrap}
        .biawin-catalog-list-table td{padding:10px 14px;border-bottom:1px solid ${color.line};color:${color.ink};vertical-align:middle}
        .biawin-catalog-list-table tr:last-child td{border-bottom:none}
        .biawin-catalog-list-title a{color:${color.primary};font-weight:700;text-decoration:none}
        .biawin-catalog-list-title a:hover{text-decoration:underline}
      `}</style>
    </div>
  );
}
