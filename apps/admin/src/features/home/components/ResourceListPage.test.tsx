import { renderToStaticMarkup } from "react-dom/server";
import { ResourceListPage } from "./ResourceListPage";

interface Row {
  id: string;
  title: string;
  active: boolean;
}

const rows: Row[] = [
  { id: "a", title: "ردیف اول", active: true },
  { id: "b", title: "ردیف دوم", active: false },
];

function baseProps(overrides: Partial<Parameters<typeof ResourceListPage<Row>>[0]> = {}) {
  return {
    title: "عنوان صفحه",
    description: "توضیح صفحه",
    newHref: "/home/hero-cards/new",
    newLabel: "+ مورد جدید",
    canManage: true,
    items: rows,
    loadError: null,
    actionError: null,
    successMessage: null,
    getId: (item: Row) => item.id,
    getActive: (item: Row) => item.active,
    getThumbnail: () => null,
    getTitle: (item: Row) => item.title,
    columns: [{ header: "ستون اضافه", render: (item: Row) => `مقدار-${item.id}` }],
    editHref: (item: Row) => `/home/hero-cards/${item.id}`,
    onToggleActive: jest.fn(),
    togglingId: null,
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
    reorderBusy: false,
    onDelete: jest.fn(),
    deleteTarget: null,
    deleteBusy: false,
    deleteError: null,
    onConfirmDelete: jest.fn(),
    onCancelDelete: jest.fn(),
    deleteDescriptionFor: (item: Row) => `حذف ${item.title}`,
    emptyLabel: "چیزی ثبت نشده است.",
    ...overrides,
  };
}

/**
 * `ResourceListPage` is the shared, purely-presentational list scaffold
 * behind all 4 Home resources' list pages (HeroCardsListContent,
 * ServiceBannersListContent, ServiceMosaicListContent, NewsListContent) —
 * unlike those pages it fetches nothing itself, so `renderToStaticMarkup`
 * exercises its *real* rendered output (not stuck on a loading state),
 * making this the most direct place to verify "list rendering" and the
 * RBAC control-visibility rule for every resource at once.
 */
describe("ResourceListPage rendering", () => {
  it("renders every item's title, extra columns, and active/inactive state", () => {
    const html = renderToStaticMarkup(<ResourceListPage {...baseProps()} />);

    expect(html).toContain("ردیف اول");
    expect(html).toContain("ردیف دوم");
    expect(html).toContain("مقدار-a");
    expect(html).toContain("مقدار-b");
    expect(html).toContain("فعال");
    expect(html).toContain("غیرفعال");
  });

  it("shows the empty-state label when there are no items", () => {
    const html = renderToStaticMarkup(<ResourceListPage {...baseProps({ items: [] })} />);
    expect(html).toContain("چیزی ثبت نشده است.");
  });

  it("shows the load error banner instead of the table when loading fails", () => {
    const html = renderToStaticMarkup(<ResourceListPage {...baseProps({ items: null, loadError: "دریافت فهرست با خطا مواجه شد." })} />);
    expect(html).toContain("دریافت فهرست با خطا مواجه شد.");
  });

  it("CONTENT_EDITOR-equivalent (canManage=true) sees the new-item link, reorder controls, and delete buttons", () => {
    const html = renderToStaticMarkup(<ResourceListPage {...baseProps({ canManage: true })} />);
    expect(html).toContain("+ مورد جدید");
    expect(html).toContain("انتقال به بالا");
    expect(html).toContain("انتقال به پایین");
    expect(html).toContain("حذف");
  });

  it("SUPPORT_VIEWER-equivalent (canManage=false) sees none of the mutation controls", () => {
    const html = renderToStaticMarkup(<ResourceListPage {...baseProps({ canManage: false })} />);
    expect(html).not.toContain("+ مورد جدید");
    expect(html).not.toContain("انتقال به بالا");
    expect(html).not.toContain("انتقال به پایین");
    expect(html).not.toContain(">حذف<");
    // The row title is plain text, not an edit link, when read-only.
    expect(html).not.toContain('href="/home/hero-cards/a"');
  });
});
