import { renderToStaticMarkup } from "react-dom/server";
import HomeOverviewPage from "./page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/home",
}));

jest.mock("../../lib/auth/admin-auth-context", () => ({
  useAdminAuth: () => ({
    isAuthenticated: true,
    profile: { id: "admin-1", email: "admin@biawin.ir", fullName: "Test Admin", role: "SUPER_ADMIN", lastLoginAt: null },
    setAuthenticated: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock("../../features/home/api/home-hero-api", () => ({ homeHeroApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }) } }));
jest.mock("../../features/home/api/home-service-banner-api", () => ({ homeServiceBannerApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }) } }));
jest.mock("../../features/home/api/home-service-mosaic-api", () => ({ homeServiceMosaicApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }) } }));
jest.mock("../../features/home/api/home-news-api", () => ({ homeNewsApi: { list: jest.fn().mockResolvedValue({ items: [], total: 0, skip: 0, take: 100 }) } }));

/** "Home navigation" — the `/home` management route renders behind the same protected shell as every other admin page, with links to all 4 resources. */
describe("HomeOverviewPage rendering", () => {
  it("renders the overview heading, all 4 resource links, and the admin shell's nested Home nav", () => {
    const html = renderToStaticMarkup(<HomeOverviewPage />);

    expect(html).toContain("مدیریت خانه");
    expect(html).toContain('href="/home/hero-cards"');
    expect(html).toContain('href="/home/service-banners"');
    expect(html).toContain('href="/home/service-mosaic"');
    expect(html).toContain('href="/home/news"');
    expect(html).toContain("کارت‌های ابتدایی");
    expect(html).toContain("بنرهای خدمات");
    expect(html).toContain("موزاییک خدمات");
    expect(html).toContain("داشبورد"); // sidebar chrome, confirms AdminShell rendered
  });
});
