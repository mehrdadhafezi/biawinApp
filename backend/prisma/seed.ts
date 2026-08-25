/**
 * Seed data for local/staging development — Sprint 0-A.
 *
 * Every Category/Service/Reward item below is transcribed verbatim from the
 * prototype's own hardcoded JS data (`biawin_single_file_app_requested_edits_v15.html`,
 * see docs/01-prototype-analysis.md §5) — titles, subtitles, prices and icons
 * are real prototype content, not invented. Two explicitly-flagged exceptions:
 *
 *  - `availableMethods` per service is inferred from the prototype's free-text
 *    `badge` label (the prototype never modeled this as structured data).
 *  - The 8 subscription-tier MembershipPlans (Start/Plus/.../Organizational)
 *    only had a name in the prototype (its "membership story strip" showed
 *    icons + names only, no detail copy) — their description/benefit copy
 *    here is placeholder pending real marketing content, clearly marked below.
 *
 * Run: `pnpm --filter @biawin/backend prisma:seed` (or automatically via
 * `docker compose up`, see docker-compose.yml).
 */
import { PrismaClient, type PurchaseMethod } from '@prisma/client';
import { hashPassword } from '../src/modules/admin-auth/password-hash.util';

const prisma = new PrismaClient();

function inferMethods(badge: string): PurchaseMethod[] {
  const methods: PurchaseMethod[] = [];
  if (badge.includes('اقساط')) methods.push('installment');
  if (badge.includes('اعتبار')) methods.push('credit');
  if (methods.length === 0) methods.push('cash');
  return methods;
}

// ---------------------------------------------------------------------------
// Membership plans — 3 core cards (real, full copy from prototype) + 8 tiers
// (real names, placeholder copy — see file header).
// ---------------------------------------------------------------------------

const corePlans = [
  {
    kind: 'earn' as const,
    tier: null,
    title: 'کارت کسب درآمد',
    kicker: 'فرصت درآمدزایی',
    shortDescription: 'درآمد از معرفی و مشارکت در اکوسیستم بیاوین',
    description:
      'کارت کسب درآمد برای کاربرانی طراحی شده که می‌خواهند از معرفی خدمات، دعوت دوستان و مشارکت در کمپین‌های درآمدی بیاوین استفاده کنند. تمام فرصت‌ها و وضعیت درآمد از حساب کاربری قابل پیگیری است.',
    level: 'فعال',
    creditLabel: 'بر اساس فعالیت',
    durationLabel: '۱۲ ماه',
    priceLabel: 'رایگان',
    accentColor: '#f28a2d',
    deepColor: '#173957',
    activationActionLabel: 'فعال‌سازی کسب درآمد',
    benefits: [
      { title: 'دعوت دوستان', description: 'دریافت مزایا از معرفی کاربران جدید بر اساس کمپین فعال' },
      { title: 'کمپین‌های درآمدی', description: 'شرکت در فرصت‌های مشخص‌شده داخل باشگاه' },
      { title: 'گزارش درآمد', description: 'مشاهده وضعیت فعالیت‌ها و پاداش‌های ثبت‌شده' },
      { title: 'تسویه شفاف', description: 'مشاهده جزئیات پاداش‌ها پیش از ثبت تسویه' },
    ],
    terms: [
      'میزان درآمد بر اساس نوع کمپین و فعالیت کاربر محاسبه می‌شود.',
      'شرایط هر فرصت قبل از شروع به‌صورت شفاف نمایش داده می‌شود.',
      'فعالیت‌های تاییدشده در بخش پروفایل و گزارش‌ها ثبت می‌شوند.',
    ],
    // Note: the prototype's "services" list for this card was activity types
    // (invite friends, sales campaigns, ...), not purchase categories — so,
    // unlike the other two core plans, there's nothing real to connect here.
    categoryNames: [] as string[],
  },
  {
    kind: 'core' as const,
    tier: null,
    title: 'کارت بیاوین',
    kicker: 'عضویت اصلی باشگاه',
    shortDescription: 'یک عضویت برای اعتبار، خدمات و فرصت‌های بیشتر',
    description:
      'کارت بیاوین هسته اصلی عضویت در باشگاه است و دسترسی کاربر به خدمات منتخب، اعتبار، کیف پول، خریدهای اقساطی و مزایای باشگاه را یکپارچه می‌کند.',
    level: 'عضو باشگاه',
    creditLabel: 'متناسب با پروفایل',
    durationLabel: '۱۲ ماه',
    priceLabel: 'رایگان',
    accentColor: '#168de0',
    deepColor: '#07529a',
    activationActionLabel: 'فعال‌سازی کارت بیاوین',
    benefits: [
      { title: 'اعتبار خرید', description: 'استفاده از اعتبار متناسب با شرایط و پروفایل کاربر' },
      { title: 'خرید اقساطی', description: 'دسترسی به مدل‌های پرداخت اقساطی در خدمات منتخب' },
      { title: 'کیف پول بیاوین', description: 'استفاده از موجودی و پرداخت ترکیبی در خریدها' },
      { title: 'مزایای عضویت', description: 'دسترسی به تخفیف‌ها، ماموریت‌ها و پیشنهادهای اختصاصی' },
    ],
    terms: [
      'سقف اعتبار و شرایط خرید برای هر کاربر می‌تواند متفاوت باشد.',
      'جزئیات هر خدمت قبل از ثبت خرید نمایش داده می‌شود.',
      'مزایا و کمپین‌های باشگاه ممکن است در دوره‌های مختلف به‌روزرسانی شوند.',
    ],
    categoryNames: ['گردشگری', 'اتومبیل', 'لوازم خانگی', 'زیبایی', 'پوشاک', 'بیمه'],
  },
  {
    kind: 'reward' as const,
    tier: null,
    title: 'کارت جایزه',
    kicker: 'هدیه و پاداش',
    shortDescription: 'جوایز، امتیازها و تجربه‌های ویژه اعضای بیاوین',
    description:
      'کارت جایزه بیاوین برای دریافت هدایا، محصولات رایگان، تجربه‌های ویژه و استفاده از کیف پول جایزه طراحی شده است. در صورت کافی نبودن موجودی، پرداخت ترکیبی از کیف پول و درگاه انجام می‌شود.',
    level: 'جایزه',
    creditLabel: 'بر اساس امتیاز',
    durationLabel: 'فعال با عضویت',
    priceLabel: 'رایگان با عضویت',
    accentColor: '#22a2a7',
    deepColor: '#0b587d',
    activationActionLabel: 'مشاهده جوایز',
    benefits: [
      { title: 'هدایای منتخب', description: 'دریافت محصولات و تجربه‌های رایگان یا امتیازی' },
      { title: 'کیف پول جایزه', description: 'استفاده از موجودی برای دریافت هدایا' },
      { title: 'پرداخت ترکیبی', description: 'پرداخت باقی‌مانده از طریق درگاه در صورت نیاز' },
      { title: 'کمپین‌های ویژه', description: 'دسترسی به جوایز و فرصت‌های مناسبتی اعضا' },
    ],
    terms: [
      'موجودی کارت جایزه بر اساس فعالیت، خرید و کمپین‌های فعال تغییر می‌کند.',
      'مبلغ نهایی قبل از تایید دریافت جایزه نمایش داده می‌شود.',
      'برخی جوایز ممکن است ظرفیت یا بازه زمانی محدود داشته باشند.',
    ],
    categoryNames: [],
  },
];

/** Placeholder copy (see file header) — names are real (prototype story strip), rest is not. */
const tierPlans = [
  { tier: 'start' as const, title: 'کارت شروع', priceLabel: 'رایگان' },
  { tier: 'plus' as const, title: 'کارت پلاس', priceLabel: 'اشتراک ماهانه' },
  { tier: 'family' as const, title: 'کارت خانواده', priceLabel: 'اشتراک ماهانه' },
  { tier: 'prime' as const, title: 'کارت پرایم', priceLabel: 'اشتراک سالانه' },
  { tier: 'gift' as const, title: 'کارت هدیه', priceLabel: 'خرید یک‌باره' },
  { tier: 'travel' as const, title: 'کارت سفر', priceLabel: 'اشتراک سالانه' },
  { tier: 'lifestyle' as const, title: 'سبک زندگی', priceLabel: 'اشتراک ماهانه' },
  { tier: 'organizational' as const, title: 'کارت سازمانی', priceLabel: 'قابل تنظیم' },
].map((t, i) => ({
  kind: 'core' as const,
  tier: t.tier,
  title: t.title,
  kicker: 'عضویت بیاوین',
  shortDescription: `شروع تجربه خرید هوشمند با ${t.title}`,
  description: `توضیحات تکمیلی ${t.title} به‌زودی تکمیل می‌شود (محتوای seed موقت — نیاز به تصمیم Product).`,
  level: 'پایه',
  creditLabel: 'تا اطلاع بعدی',
  durationLabel: '۱۲ ماه',
  priceLabel: t.priceLabel,
  accentColor: '#0879dc',
  deepColor: '#074f98',
  activationActionLabel: 'فعال‌سازی کارت',
  benefits: [{ title: 'دسترسی به خدمات منتخب', description: 'جزئیات کامل در مرحله‌ی Feature تکمیل می‌شود.' }],
  terms: ['جزئیات و شرایط این کارت در مرحله‌ی Feature تکمیل می‌شود.'],
  categoryNames: [] as string[],
  sortOrder: i + 10,
}));

// ---------------------------------------------------------------------------
// Categories + Services (real content from prototype's `categoryCatalog`)
// ---------------------------------------------------------------------------

interface SeedServiceItem {
  title: string;
  group: string;
  badge: string;
  subtitle: string;
  priceLabel: string;
  icon: string;
}

interface SeedCategory {
  name: string;
  description: string;
  keywords: string[];
  items: SeedServiceItem[];
}

const categories: SeedCategory[] = [
  {
    name: 'گردشگری',
    description: 'تجربه سفر با پرداخت مرحله‌ای',
    keywords: ['گردشگری', 'سفر', 'تور', 'پرواز', 'اقساط'],
    items: [
      { title: 'تور کیش', group: 'داخلی', badge: 'اقساطی', subtitle: '۳ شب و ۴ روز با اقامت و خدمات سفر', priceLabel: 'از ۱۲٬۹۰۰٬۰۰۰ تومان', icon: '✈' },
      { title: 'تور مشهد', group: 'داخلی', badge: 'اعتباری', subtitle: '۲ شب و ۳ روز با اقامت منتخب', priceLabel: 'از ۸٬۶۰۰٬۰۰۰ تومان', icon: '🕌' },
      { title: 'تور قشم', group: 'داخلی', badge: 'اقساطی', subtitle: 'سفر ساحلی و تجربه جزیره', priceLabel: 'از ۱۰٬۸۰۰٬۰۰۰ تومان', icon: '🏝' },
      { title: 'تور استانبول', group: 'خارجی', badge: 'اقساطی', subtitle: '۴ شب و ۵ روز با پرواز و هتل', priceLabel: 'از ۲۱٬۵۰۰٬۰۰۰ تومان', icon: '🌉' },
      { title: 'تور دبی', group: 'خارجی', badge: 'اعتباری', subtitle: '۳ شب و ۴ روز با خدمات کامل', priceLabel: 'از ۲۶٬۲۰۰٬۰۰۰ تومان', icon: '🏙' },
      { title: 'تور آنتالیا', group: 'خارجی', badge: 'اقساطی', subtitle: '۶ شب و ۷ روز ساحلی', priceLabel: 'از ۳۳٬۹۰۰٬۰۰۰ تومان', icon: '🌊' },
      { title: 'تور وان', group: 'خارجی', badge: 'اقتصادی', subtitle: '۳ شب و ۴ روز سفر زمینی', priceLabel: 'از ۱۸٬۴۰۰٬۰۰۰ تومان', icon: '🧳' },
      { title: 'رزرو هتل', group: 'خدمات سفر', badge: 'اعتباری', subtitle: 'هتل داخلی و خارجی با انتخاب متنوع', priceLabel: 'قیمت روز', icon: '🏨' },
    ],
  },
  {
    name: 'اتومبیل',
    description: 'خرید خودرو با اعتبار بیاوین',
    keywords: ['خودرو', 'ماشین', 'اقساط', 'خرید'],
    items: [
      { title: 'فیدلیتی پرایم', group: 'شاسی‌بلند', badge: 'اعتباری', subtitle: 'خودروی خانوادگی با شرایط منعطف', priceLabel: 'از ۱٬۹۸۰٬۰۰۰٬۰۰۰ تومان', icon: '🚙' },
      { title: 'تیگو ۷ پرو', group: 'شاسی‌بلند', badge: 'اقساطی', subtitle: 'کراس‌اوور مدرن با امکانات کامل', priceLabel: 'از ۲٬۴۵۰٬۰۰۰٬۰۰۰ تومان', icon: '🚘' },
      { title: 'لاماری ایما', group: 'شاسی‌بلند', badge: 'اعتباری', subtitle: 'طراحی اسپرت و بازپرداخت مرحله‌ای', priceLabel: 'از ۲٬۲۴۰٬۰۰۰٬۰۰۰ تومان', icon: '🚙' },
      { title: 'جک JS4', group: 'شاسی‌بلند', badge: 'اقساطی', subtitle: 'کراس‌اوور شهری با خرید آسان', priceLabel: 'از ۱٬۶۹۰٬۰۰۰٬۰۰۰ تومان', icon: '🚘' },
      { title: 'شاهین اتومات', group: 'سدان', badge: 'اقساطی', subtitle: 'سدان اتوماتیک مناسب استفاده شهری', priceLabel: 'از ۹۴۰٬۰۰۰٬۰۰۰ تومان', icon: '🚗' },
      { title: 'دنا پلاس', group: 'سدان', badge: 'اعتباری', subtitle: 'سدان خانوادگی با اقساط بلندمدت', priceLabel: 'از ۸۵۰٬۰۰۰٬۰۰۰ تومان', icon: '🚗' },
      { title: 'خدمات سرویس خودرو', group: 'خدمات خودرو', badge: 'خدمت', subtitle: 'سرویس دوره‌ای و نگهداری خودرو', priceLabel: 'از ۲٬۵۰۰٬۰۰۰ تومان', icon: '🔧' },
      { title: 'لوازم جانبی خودرو', group: 'خدمات خودرو', badge: 'اعتباری', subtitle: 'تجهیزات و لوازم کاربردی خودرو', priceLabel: 'قیمت روز', icon: '🛞' },
    ],
  },
  {
    name: 'لوازم خانگی',
    description: 'برندهای معتبر و متنوع',
    keywords: ['لوازم خانگی', 'خانه', 'کالا', 'اقساط'],
    items: [
      { title: 'تلویزیون', group: 'صوتی و تصویری', badge: 'اقساطی', subtitle: 'مدل‌های هوشمند در اندازه‌های مختلف', priceLabel: 'از ۲۴٬۰۰۰٬۰۰۰ تومان', icon: '📺' },
      { title: 'میز تلویزیون', group: 'خانه و دکور', badge: 'اعتباری', subtitle: 'مدل‌های مدرن، مینیمال و کاربردی', priceLabel: 'از ۶٬۵۰۰٬۰۰۰ تومان', icon: '🪵' },
      { title: 'یخچال و فریزر', group: 'آشپزخانه', badge: 'اقساطی', subtitle: 'مدل‌های کم‌مصرف و جادار', priceLabel: 'از ۴۸٬۰۰۰٬۰۰۰ تومان', icon: '🧊' },
      { title: 'ماشین لباسشویی', group: 'شست‌وشو', badge: 'اعتباری', subtitle: 'ظرفیت‌های مختلف با موتور کم‌مصرف', priceLabel: 'از ۲۹٬۰۰۰٬۰۰۰ تومان', icon: '🫧' },
      { title: 'ماشین ظرفشویی', group: 'شست‌وشو', badge: 'اقساطی', subtitle: 'مدل‌های رومیزی و ایستاده', priceLabel: 'از ۳۳٬۰۰۰٬۰۰۰ تومان', icon: '🍽' },
      { title: 'بخارپز', group: 'لوازم پخت‌وپز', badge: 'اقتصادی', subtitle: 'پخت سالم و سریع برای استفاده روزانه', priceLabel: 'از ۴٬۹۰۰٬۰۰۰ تومان', icon: '♨' },
      { title: 'مایکروویو', group: 'لوازم پخت‌وپز', badge: 'اعتباری', subtitle: 'گرم‌کردن و پخت سریع با برنامه‌های متنوع', priceLabel: 'از ۱۲٬۵۰۰٬۰۰۰ تومان', icon: '🍲' },
      { title: 'جاروبرقی', group: 'نظافت', badge: 'اقساطی', subtitle: 'قدرت مکش بالا و مصرف بهینه', priceLabel: 'از ۹٬۸۰۰٬۰۰۰ تومان', icon: '🧹' },
    ],
  },
  {
    name: 'طلا و جواهر',
    description: 'خرید مطمئن و هدفمند',
    keywords: ['طلا', 'جواهر', 'سرمایه گذاری'],
    items: [
      { title: 'انگشتر طلا', group: 'زیورآلات', badge: 'اعتباری', subtitle: 'مدل‌های ظریف و مجلسی', priceLabel: 'قیمت روز طلا', icon: '💍' },
      { title: 'دستبند طلا', group: 'زیورآلات', badge: 'اقساطی', subtitle: 'طرح‌های کلاسیک و مدرن', priceLabel: 'قیمت روز طلا', icon: '✨' },
      { title: 'گردنبند طلا', group: 'زیورآلات', badge: 'اعتباری', subtitle: 'مدل‌های روزمره و مناسب هدیه', priceLabel: 'قیمت روز طلا', icon: '📿' },
      { title: 'سرویس طلا', group: 'مجلسی', badge: 'اقساطی', subtitle: 'ست کامل برای مراسم و هدیه', priceLabel: 'قیمت روز طلا', icon: '👑' },
      { title: 'سکه', group: 'سرمایه‌گذاری', badge: 'اعتباری', subtitle: 'گزینه مناسب پس‌انداز و سرمایه‌گذاری', priceLabel: 'قیمت روز', icon: '🪙' },
      { title: 'شمش طلا', group: 'سرمایه‌گذاری', badge: 'اعتباری', subtitle: 'وزن‌های متنوع و بسته‌بندی امن', priceLabel: 'قیمت روز', icon: '🏅' },
    ],
  },
  {
    name: 'پوشاک',
    description: 'خرید از برندهای منتخب',
    keywords: ['پوشاک', 'لباس', 'مد', 'استایل'],
    items: [
      { title: 'مانتو و کت زنانه', group: 'زنانه', badge: 'اقساطی', subtitle: 'مدل‌های روزمره و رسمی', priceLabel: 'از ۲٬۸۰۰٬۰۰۰ تومان', icon: '👗' },
      { title: 'پوشاک مردانه', group: 'مردانه', badge: 'اعتباری', subtitle: 'پیراهن، شلوار، کت و استایل روزانه', priceLabel: 'از ۲٬۲۰۰٬۰۰۰ تومان', icon: '👔' },
      { title: 'کفش', group: 'کفش و اکسسوری', badge: 'اقساطی', subtitle: 'مدل‌های رسمی، روزمره و ورزشی', priceLabel: 'از ۱٬۹۰۰٬۰۰۰ تومان', icon: '👟' },
      { title: 'کیف', group: 'کفش و اکسسوری', badge: 'اعتباری', subtitle: 'کیف زنانه، مردانه و اداری', priceLabel: 'از ۱٬۷۰۰٬۰۰۰ تومان', icon: '👜' },
      { title: 'پوشاک کودک', group: 'کودک', badge: 'اقتصادی', subtitle: 'لباس مناسب سنین مختلف', priceLabel: 'از ۹۰۰٬۰۰۰ تومان', icon: '🧸' },
      { title: 'لباس ورزشی', group: 'ورزشی', badge: 'اقساطی', subtitle: 'ست تمرین و پوشاک تخصصی', priceLabel: 'از ۱٬۴۰۰٬۰۰۰ تومان', icon: '🏃' },
    ],
  },
  {
    name: 'زیبایی',
    description: 'محصولات و خدمات زیبایی و مراقبتی',
    keywords: ['زیبایی', 'آرایشی'],
    items: [
      { title: 'محصولات مراقبت پوست', group: 'مراقبت پوست', badge: 'اعتباری', subtitle: 'پاک‌کننده، سرم، کرم و ضدآفتاب', priceLabel: 'از ۷۵۰٬۰۰۰ تومان', icon: '🧴' },
      { title: 'محصولات مراقبت مو', group: 'مراقبت مو', badge: 'اقساطی', subtitle: 'شامپو، ماسک و محصولات تخصصی مو', priceLabel: 'از ۶۵۰٬۰۰۰ تومان', icon: '🪮' },
      { title: 'لوازم آرایشی', group: 'آرایش', badge: 'اعتباری', subtitle: 'محصولات آرایش صورت، چشم و لب', priceLabel: 'از ۵۵۰٬۰۰۰ تومان', icon: '💄' },
      { title: 'عطر و ادکلن', group: 'عطر', badge: 'اقساطی', subtitle: 'رایحه‌های زنانه و مردانه', priceLabel: 'از ۲٬۵۰۰٬۰۰۰ تومان', icon: '🌸' },
      { title: 'خدمات پوست و مو', group: 'خدمات زیبایی', badge: 'خدمت', subtitle: 'پاکسازی، مراقبت و خدمات تخصصی', priceLabel: 'از ۱٬۲۰۰٬۰۰۰ تومان', icon: '✨' },
      { title: 'خدمات ناخن', group: 'خدمات زیبایی', badge: 'خدمت', subtitle: 'مانیکور، پدیکور و طراحی ناخن', priceLabel: 'از ۶۰۰٬۰۰۰ تومان', icon: '💅' },
    ],
  },
  {
    name: 'بیمه',
    description: 'پوشش بیمه‌ای متنوع با پرداخت منعطف',
    keywords: ['بیمه'],
    items: [
      { title: 'بیمه شخص ثالث', group: 'خودرو', badge: 'اقساطی', subtitle: 'پوشش اجباری خودرو با پرداخت منعطف', priceLabel: 'محاسبه آنلاین', icon: '🚗' },
      { title: 'بیمه بدنه', group: 'خودرو', badge: 'اعتباری', subtitle: 'پوشش خسارت‌های واردشده به خودرو', priceLabel: 'محاسبه آنلاین', icon: '🛡' },
      { title: 'بیمه درمان تکمیلی', group: 'سلامت', badge: 'اقساطی', subtitle: 'پوشش هزینه‌های درمان و بستری', priceLabel: 'از ماهانه ۱٬۰۰۰٬۰۰۰ تومان', icon: '🏥' },
      { title: 'بیمه عمر و سرمایه‌گذاری', group: 'آینده مالی', badge: 'اعتباری', subtitle: 'پوشش بلندمدت همراه با سرمایه‌گذاری', priceLabel: 'از ماهانه ۱٬۰۰۰٬۰۰۰ تومان', icon: '❤️' },
      { title: 'بیمه مسئولیت', group: 'کسب‌وکار', badge: 'خدمت', subtitle: 'پوشش مسئولیت حرفه‌ای و شغلی', priceLabel: 'محاسبه آنلاین', icon: '💼' },
      { title: 'بیمه مسافرتی', group: 'سفر', badge: 'سریع', subtitle: 'پوشش درمان و حوادث در سفر', priceLabel: 'از ۵۰۰٬۰۰۰ تومان', icon: '✈' },
    ],
  },
  {
    name: 'دیجیتال',
    description: 'انتخاب هوشمند کالای دیجیتال',
    keywords: ['دیجیتال'],
    items: [
      { title: 'گوشی موبایل', group: 'موبایل', badge: 'اقساطی', subtitle: 'مدل‌های متنوع از برندهای محبوب', priceLabel: 'از ۱۲٬۰۰۰٬۰۰۰ تومان', icon: '📱' },
      { title: 'لپ‌تاپ', group: 'رایانه', badge: 'اعتباری', subtitle: 'مدل‌های دانشجویی، اداری و حرفه‌ای', priceLabel: 'از ۲۸٬۰۰۰٬۰۰۰ تومان', icon: '💻' },
      { title: 'تبلت', group: 'رایانه', badge: 'اقساطی', subtitle: 'برای آموزش، سرگرمی و کار روزانه', priceLabel: 'از ۱۴٬۰۰۰٬۰۰۰ تومان', icon: '📲' },
      { title: 'کنسول بازی', group: 'سرگرمی', badge: 'اعتباری', subtitle: 'کنسول و تجهیزات گیمینگ', priceLabel: 'از ۲۶٬۰۰۰٬۰۰۰ تومان', icon: '🎮' },
      { title: 'ساعت هوشمند', group: 'گجت', badge: 'اقساطی', subtitle: 'پایش سلامت و مدیریت اعلان‌ها', priceLabel: 'از ۳٬۵۰۰٬۰۰۰ تومان', icon: '⌚' },
      { title: 'هدفون و هندزفری', group: 'صوتی', badge: 'اقتصادی', subtitle: 'مدل‌های بی‌سیم و حرفه‌ای', priceLabel: 'از ۱٬۵۰۰٬۰۰۰ تومان', icon: '🎧' },
    ],
  },
  {
    name: 'سلامت',
    description: 'خدمات درمانی و تشخیصی متنوع',
    keywords: ['سلامت'],
    items: [
      { title: 'دندانپزشکی', group: 'درمان', badge: 'اقساطی', subtitle: 'خدمات ترمیمی، زیبایی و درمانی', priceLabel: 'از ۲٬۰۰۰٬۰۰۰ تومان', icon: '🦷' },
      { title: 'آزمایش و چکاپ', group: 'تشخیص', badge: 'اعتباری', subtitle: 'پکیج‌های آزمایش و بررسی سلامت', priceLabel: 'از ۸۰۰٬۰۰۰ تومان', icon: '🧪' },
      { title: 'پوست و مو', group: 'کلینیک', badge: 'اقساطی', subtitle: 'خدمات درمانی و تخصصی پوست و مو', priceLabel: 'از ۱٬۵۰۰٬۰۰۰ تومان', icon: '🩺' },
      { title: 'تغذیه و لاغری', group: 'سبک زندگی', badge: 'خدمت', subtitle: 'مشاوره و برنامه تخصصی تغذیه', priceLabel: 'از ۷۰۰٬۰۰۰ تومان', icon: '🥗' },
      { title: 'فیزیوتراپی', group: 'توانبخشی', badge: 'اعتباری', subtitle: 'جلسات درمانی و بازتوانی', priceLabel: 'از ۶۰۰٬۰۰۰ تومان', icon: '🦿' },
      { title: 'بینایی‌سنجی و عینک', group: 'بینایی', badge: 'اقساطی', subtitle: 'معاینه و خرید عینک طبی', priceLabel: 'از ۲٬۰۰۰٬۰۰۰ تومان', icon: '👓' },
    ],
  },
  {
    name: 'باشگاه و ورزش',
    description: 'اشتراک باشگاه، کلاس و تجهیزات ورزشی',
    keywords: ['ورزش', 'باشگاه'],
    items: [
      { title: 'بدنسازی', group: 'باشگاه', badge: 'اشتراک', subtitle: 'عضویت باشگاه و برنامه تمرینی', priceLabel: 'از ماهانه ۱٬۲۰۰٬۰۰۰ تومان', icon: '🏋️' },
      { title: 'یوگا و پیلاتس', group: 'کلاس گروهی', badge: 'اشتراک', subtitle: 'کلاس‌های منظم و مربی تخصصی', priceLabel: 'از ماهانه ۹۰۰٬۰۰۰ تومان', icon: '🧘' },
      { title: 'شنا', group: 'ورزش آبی', badge: 'اقساطی', subtitle: 'کلاس و سانس‌های استخر', priceLabel: 'از ۸۰۰٬۰۰۰ تومان', icon: '🏊' },
      { title: 'فوتبال و فوتسال', group: 'تیمی', badge: 'رزرو', subtitle: 'رزرو زمین و دوره‌های آموزشی', priceLabel: 'از ۶۰۰٬۰۰۰ تومان', icon: '⚽' },
      { title: 'لوازم ورزشی', group: 'تجهیزات', badge: 'اعتباری', subtitle: 'تجهیزات تمرین در خانه و باشگاه', priceLabel: 'از ۱٬۵۰۰٬۰۰۰ تومان', icon: '🏃' },
      { title: 'مربی خصوصی', group: 'آموزش', badge: 'خدمت', subtitle: 'برنامه تمرینی اختصاصی', priceLabel: 'از جلسه‌ای ۷۰۰٬۰۰۰ تومان', icon: '🎯' },
    ],
  },
  {
    name: 'کارت هدیه',
    description: 'اعتبار قابل استفاده در خدمات منتخب بیاوین',
    keywords: ['کارت هدیه'],
    items: [
      { title: 'کارت هدیه ۱ میلیون', group: 'هدیه', badge: 'فوری', subtitle: 'مناسب هدیه‌های روزمره و مناسبتی', priceLabel: '۱٬۰۰۰٬۰۰۰ تومان', icon: '🎁' },
      { title: 'کارت هدیه ۳ میلیون', group: 'هدیه', badge: 'محبوب', subtitle: 'اعتبار قابل استفاده در خدمات منتخب', priceLabel: '۳٬۰۰۰٬۰۰۰ تومان', icon: '🎁' },
      { title: 'کارت هدیه ۵ میلیون', group: 'هدیه', badge: 'ویژه', subtitle: 'برای خرید و تجربه‌های ارزشمندتر', priceLabel: '۵٬۰۰۰٬۰۰۰ تومان', icon: '🎟' },
      { title: 'کارت هدیه سازمانی', group: 'سازمانی', badge: 'سفارشی', subtitle: 'مناسب کارکنان و کمپین‌های سازمانی', priceLabel: 'قابل تنظیم', icon: '🏢' },
    ],
  },
  {
    name: 'موبایل و لپ‌تاپ',
    description: 'گوشی و لپ‌تاپ با اقساط و اعتبار',
    keywords: ['موبایل', 'لپ‌تاپ'],
    items: [
      { title: 'گوشی اقتصادی', group: 'موبایل', badge: 'اقساطی', subtitle: 'مدل‌های کاربردی برای استفاده روزانه', priceLabel: 'از ۹٬۰۰۰٬۰۰۰ تومان', icon: '📱' },
      { title: 'گوشی پرچمدار', group: 'موبایل', badge: 'اعتباری', subtitle: 'مدل‌های حرفه‌ای و جدید', priceLabel: 'از ۴۵٬۰۰۰٬۰۰۰ تومان', icon: '📱' },
      { title: 'لپ‌تاپ دانشجویی', group: 'لپ‌تاپ', badge: 'اقساطی', subtitle: 'مناسب آموزش و کارهای روزمره', priceLabel: 'از ۲۵٬۰۰۰٬۰۰۰ تومان', icon: '💻' },
      { title: 'لپ‌تاپ حرفه‌ای', group: 'لپ‌تاپ', badge: 'اعتباری', subtitle: 'مناسب طراحی، برنامه‌نویسی و کار تخصصی', priceLabel: 'از ۵۵٬۰۰۰٬۰۰۰ تومان', icon: '💻' },
      { title: 'لوازم جانبی', group: 'تجهیزات', badge: 'اقتصادی', subtitle: 'شارژر، پاوربانک، کیف و لوازم کاربردی', priceLabel: 'از ۵۰۰٬۰۰۰ تومان', icon: '🔌' },
    ],
  },
  {
    name: 'خانه و زندگی',
    description: 'خریدهای ضروری و بزرگ برای خانه',
    keywords: ['خانه', 'زندگی'],
    items: [
      { title: 'لوازم آشپزخانه', group: 'آشپزخانه', badge: 'اقساطی', subtitle: 'وسایل کاربردی برای آشپزی و پذیرایی', priceLabel: 'از ۱٬۰۰۰٬۰۰۰ تومان', icon: '🍳' },
      { title: 'کالای خواب', group: 'اتاق خواب', badge: 'اعتباری', subtitle: 'تشک، بالش، سرویس خواب و منسوجات', priceLabel: 'از ۳٬۵۰۰٬۰۰۰ تومان', icon: '🛏' },
      { title: 'دکوراسیون', group: 'دکور', badge: 'اقساطی', subtitle: 'اکسسوری و عناصر زیبایی خانه', priceLabel: 'از ۸۰۰٬۰۰۰ تومان', icon: '🪴' },
      { title: 'روشنایی', group: 'برق و نور', badge: 'اعتباری', subtitle: 'لوستر، آباژور و نورپردازی', priceLabel: 'از ۱٬۵۰۰٬۰۰۰ تومان', icon: '💡' },
      { title: 'فرش و کفپوش', group: 'دکور', badge: 'اقساطی', subtitle: 'فرش، قالیچه و کفپوش متنوع', priceLabel: 'از ۵٬۰۰۰٬۰۰۰ تومان', icon: '🧶' },
    ],
  },
  {
    name: 'مبلمان',
    description: 'خرید منعطف برای خانه‌ای کامل‌تر',
    keywords: ['مبلمان'],
    items: [
      { title: 'مبل راحتی', group: 'نشیمن', badge: 'اقساطی', subtitle: 'مدل‌های خانوادگی و راحتی', priceLabel: 'از ۴۵٬۰۰۰٬۰۰۰ تومان', icon: '🛋' },
      { title: 'مبل کلاسیک', group: 'پذیرایی', badge: 'اعتباری', subtitle: 'طرح‌های رسمی و مجلسی', priceLabel: 'از ۷۵٬۰۰۰٬۰۰۰ تومان', icon: '🪑' },
      { title: 'میز ناهارخوری', group: 'ناهارخوری', badge: 'اقساطی', subtitle: 'ست‌های ۴، ۶ و ۸ نفره', priceLabel: 'از ۲۴٬۰۰۰٬۰۰۰ تومان', icon: '🍽' },
      { title: 'سرویس خواب', group: 'اتاق خواب', badge: 'اعتباری', subtitle: 'تخت، پاتختی و میز آرایش', priceLabel: 'از ۳۵٬۰۰۰٬۰۰۰ تومان', icon: '🛏' },
      { title: 'میز تلویزیون', group: 'نشیمن', badge: 'اقتصادی', subtitle: 'مدل‌های مدرن و کم‌جا', priceLabel: 'از ۶٬۵۰۰٬۰۰۰ تومان', icon: '📺' },
    ],
  },
  {
    name: 'آموزش',
    description: 'دوره‌های آموزشی با پرداخت منعطف',
    keywords: ['آموزش'],
    items: [
      { title: 'آموزش زبان', group: 'زبان', badge: 'اقساطی', subtitle: 'دوره‌های ترمیک و فشرده', priceLabel: 'از ۳٬۰۰۰٬۰۰۰ تومان', icon: '🗣' },
      { title: 'آموزش مهارت‌های دیجیتال', group: 'تخصصی', badge: 'اعتباری', subtitle: 'طراحی، برنامه‌نویسی و بازاریابی', priceLabel: 'از ۴٬۰۰۰٬۰۰۰ تومان', icon: '💻' },
      { title: 'دوره‌های مدیریتی', group: 'کسب‌وکار', badge: 'اقساطی', subtitle: 'فروش، مدیریت و توسعه کسب‌وکار', priceLabel: 'از ۵٬۰۰۰٬۰۰۰ تومان', icon: '📊' },
      { title: 'آموزش کودک', group: 'کودک', badge: 'اشتراک', subtitle: 'مهارت‌آموزی و کلاس‌های خلاقیت', priceLabel: 'از ۱٬۵۰۰٬۰۰۰ تومان', icon: '🎨' },
      { title: 'آمادگی آزمون', group: 'آزمون', badge: 'اعتباری', subtitle: 'دوره‌های جمع‌بندی و مشاوره', priceLabel: 'از ۳٬۵۰۰٬۰۰۰ تومان', icon: '📚' },
    ],
  },
  {
    name: 'خدمات سازمانی',
    description: 'راهکارهای اعتباری و رفاهی برای سازمان‌ها',
    keywords: ['سازمانی', 'کسب و کار'],
    items: [
      { title: 'کارت اعتباری کارکنان', group: 'اعتبار', badge: 'سازمانی', subtitle: 'اعتبار خرید ویژه کارکنان مجموعه', priceLabel: 'قابل تنظیم', icon: '💳' },
      { title: 'باشگاه مشتریان سازمانی', group: 'وفاداری', badge: 'سازمانی', subtitle: 'امتیاز، هدیه و مزایای اختصاصی', priceLabel: 'درخواست مشاوره', icon: '🎯' },
      { title: 'بسته رفاهی کارکنان', group: 'رفاهی', badge: 'سفارشی', subtitle: 'ترکیب خدمات سلامت، سفر و خرید', priceLabel: 'قابل تنظیم', icon: '🎁' },
      { title: 'کمپین فروش و انگیزشی', group: 'کمپین', badge: 'سفارشی', subtitle: 'راهکارهای فروش و انگیزش شبکه', priceLabel: 'درخواست مشاوره', icon: '🚀' },
    ],
  },
  {
    name: 'خرید روزمره',
    description: 'کالاهای مصرفی و خرید روزانه با اعتبار',
    keywords: ['خرید روزمره'],
    items: [
      { title: 'سوپرمارکت', group: 'خوراکی', badge: 'اعتباری', subtitle: 'کالاهای مصرفی و خرید روزانه', priceLabel: 'از ۵۰۰٬۰۰۰ تومان', icon: '🛒' },
      { title: 'پروتئینی', group: 'خوراکی', badge: 'اعتباری', subtitle: 'گوشت، مرغ و محصولات پروتئینی', priceLabel: 'قیمت روز', icon: '🥩' },
      { title: 'میوه و سبزیجات', group: 'تازه', badge: 'روزانه', subtitle: 'محصولات تازه و منتخب', priceLabel: 'قیمت روز', icon: '🥬' },
      { title: 'محصولات شوینده', group: 'خانه', badge: 'اقتصادی', subtitle: 'شوینده و بهداشت خانه', priceLabel: 'از ۳۰۰٬۰۰۰ تومان', icon: '🧼' },
      { title: 'محصولات بهداشتی', group: 'شخصی', badge: 'اعتباری', subtitle: 'بهداشت و مراقبت روزانه', priceLabel: 'از ۲۵۰٬۰۰۰ تومان', icon: '🧴' },
    ],
  },
  {
    name: 'مالی و اعتباری',
    description: 'اعتبار، کیف پول و اقساط بلندمدت',
    keywords: ['مالی', 'اعتباری'],
    items: [
      { title: 'اعتبار خرید کالا', group: 'اعتبار', badge: 'اعتباری', subtitle: 'افزایش قدرت خرید برای کالاهای منتخب', priceLabel: 'تا ۳ برابر اعتبار', icon: '💳' },
      { title: 'اعتبار خدمات', group: 'اعتبار', badge: 'اعتباری', subtitle: 'استفاده از خدمات با پرداخت مرحله‌ای', priceLabel: 'قابل محاسبه', icon: '🏦' },
      { title: 'کیف پول بیاوین', group: 'کیف پول', badge: 'فوری', subtitle: 'شارژ، پرداخت و مدیریت موجودی', priceLabel: 'بدون هزینه فعال‌سازی', icon: '👛' },
      { title: 'طرح اقساط بلندمدت', group: 'اقساط', badge: 'اقساطی', subtitle: 'بازپرداخت منعطف برای خریدهای بزرگ', priceLabel: 'تا ۳۶ ماه', icon: '📅' },
    ],
  },
  {
    name: 'کودک و نوجوان',
    description: 'کالا و خدمات مناسب سنین مختلف',
    keywords: ['کودک', 'نوجوان'],
    items: [
      { title: 'اسباب‌بازی', group: 'سرگرمی', badge: 'اقساطی', subtitle: 'بازی‌های فکری و سرگرمی مناسب سن', priceLabel: 'از ۵۰۰٬۰۰۰ تومان', icon: '🧸' },
      { title: 'پوشاک کودک', group: 'پوشاک', badge: 'اعتباری', subtitle: 'لباس و کفش برای سنین مختلف', priceLabel: 'از ۸۰۰٬۰۰۰ تومان', icon: '👕' },
      { title: 'لوازم تحریر', group: 'آموزش', badge: 'اقتصادی', subtitle: 'نوشت‌افزار و تجهیزات آموزشی', priceLabel: 'از ۳۰۰٬۰۰۰ تومان', icon: '✏️' },
      { title: 'کلاس‌های مهارتی', group: 'آموزش', badge: 'اشتراک', subtitle: 'خلاقیت، زبان و مهارت‌آموزی', priceLabel: 'از ۱٬۲۰۰٬۰۰۰ تومان', icon: '🎨' },
      { title: 'لوازم نوزاد', group: 'نوزاد', badge: 'اعتباری', subtitle: 'کالسکه، صندلی و وسایل ضروری', priceLabel: 'از ۲٬۰۰۰٬۰۰۰ تومان', icon: '👶' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Rewards (real content — the prototype's 16 reward products)
// ---------------------------------------------------------------------------

const rewards = [
  { title: 'پک آرایشی ویژه', cost: 350_000, description: 'پک محصولات آرایشی منتخب.' },
  { title: 'عطر و اسپری', cost: 280_000, description: 'عطر و اسپری خوشبوکننده منتخب.' },
  { title: 'پک مراقبت پوست', cost: 420_000, description: 'پک محصولات مراقبت پوست.' },
  { title: 'کارت هدیه خرید', cost: 500_000, description: 'کارت هدیه قابل استفاده در خدمات منتخب بیاوین.' },
  { title: 'اکسسوری طلایی', cost: 650_000, description: 'اکسسوری با روکش طلا.' },
  { title: 'هدیه خانه و زندگی', cost: 390_000, description: 'محصول منتخب حوزه خانه و زندگی.' },
  { title: 'بسته سبک زندگی', cost: 320_000, description: 'بسته محصولات سبک زندگی.' },
  { title: 'تجربه سفر', cost: 5_000_000, description: 'تجربه سفر ویژه اعضای بیاوین.' },
  { title: 'سرویس ویژه بیاوین', cost: 250_000, description: 'سرویس ویژه اعضای باشگاه.' },
  { title: 'پک مراقبت مو', cost: 320_000, description: 'پک محصولات مراقبت مو.' },
  { title: 'اعتبار هدیه خرید', cost: 450_000, description: 'اعتبار هدیه قابل استفاده در خرید.' },
  { title: 'پک کافه و رستوران', cost: 380_000, description: 'اعتبار استفاده در کافه و رستوران‌های منتخب.' },
  { title: 'بلیت سینما دونفره', cost: 180_000, description: 'دو بلیت سینما.' },
  { title: 'اشتراک باشگاه ورزشی', cost: 600_000, description: 'اشتراک یک‌ماهه باشگاه ورزشی.' },
  { title: 'مشاوره آنلاین ویژه', cost: 220_000, description: 'یک جلسه مشاوره آنلاین اختصاصی.' },
  { title: 'پک هدیه کودک', cost: 290_000, description: 'پک هدیه مناسب کودکان.' },
];

// ---------------------------------------------------------------------------
// Orbit items — the frozen 12-item Landing catalog (Stage 1.9). ids/order/
// position/animation are transcribed verbatim from
// apps/web/src/components/landing/orbitItems.ts's MOCK_ORBIT_ITEMS so the
// Admin-managed catalog starts identical to what's already live. `imageKey`
// is set for all 12 items with a real, QA'd asset in apps/web/public/orbit/
// (see docs/14-orbit-asset-qa-report.md, docs/15-orbit-asset-qa-report-batch2.md;
// `insurance` passed QA last, after two rejected CGI-badge attempts — a real
// photographed shield keychain, single object, real alpha, unclipped by the
// circular bubble mask).
// ---------------------------------------------------------------------------

const orbitItems = [
  { slug: 'food', title: 'خرید روزمره', imageKey: 'orbit/orbit_11_food.webp', sortOrder: 1, positionConfig: { leftPercent: 29.2, topPercent: 29.0 }, animationConfig: { variant: 'a', delaySeconds: -0.0 } },
  { slug: 'clothing', title: 'پوشاک', imageKey: 'orbit/orbit_01_clothing.webp', sortOrder: 2, positionConfig: { leftPercent: 50.0, topPercent: 25.4 }, animationConfig: { variant: 'b', delaySeconds: -0.47 } },
  { slug: 'motorcycle', title: 'موتورسیکلت', imageKey: 'orbit/orbit_09_motorcycle.webp', sortOrder: 3, positionConfig: { leftPercent: 69.1, topPercent: 29.9 }, animationConfig: { variant: 'c', delaySeconds: -0.94 } },
  { slug: 'vehicle', title: 'خودرو', imageKey: 'orbit/orbit_02_vehicle.webp', sortOrder: 4, positionConfig: { leftPercent: 84.5, topPercent: 37.7 }, animationConfig: { variant: 'd', delaySeconds: -1.41 } },
  { slug: 'gold-jewelry', title: 'طلا و جواهر', imageKey: 'orbit/orbit_03_gold-jewelry.webp', sortOrder: 5, positionConfig: { leftPercent: 86.6, topPercent: 47.8 }, animationConfig: { variant: 'b', delaySeconds: -1.88 } },
  { slug: 'tourism', title: 'گردشگری', imageKey: 'orbit/orbit_04_tourism.webp', sortOrder: 6, positionConfig: { leftPercent: 84.5, topPercent: 58.0 }, animationConfig: { variant: 'a', delaySeconds: -2.35 } },
  { slug: 'home-appliance', title: 'لوازم خانگی', imageKey: 'orbit/orbit_05_home-appliance.webp', sortOrder: 7, positionConfig: { leftPercent: 75.5, topPercent: 67.9 }, animationConfig: { variant: 'c', delaySeconds: -2.82 } },
  { slug: 'carpet', title: 'فرش', imageKey: 'orbit/orbit_10_carpet.webp', sortOrder: 8, positionConfig: { leftPercent: 54.7, topPercent: 73.3 }, animationConfig: { variant: 'd', delaySeconds: -0.0 } },
  { slug: 'beauty', title: 'زیبایی', imageKey: 'orbit/orbit_06_beauty.webp', sortOrder: 9, positionConfig: { leftPercent: 37.2, topPercent: 74.0 }, animationConfig: { variant: 'a', delaySeconds: -0.47 } },
  { slug: 'digital', title: 'دیجیتال', imageKey: 'orbit/orbit_07_digital.webp', sortOrder: 10, positionConfig: { leftPercent: 19.1, topPercent: 68.2 }, animationConfig: { variant: 'b', delaySeconds: -0.94 } },
  { slug: 'insurance', title: 'بیمه', imageKey: 'orbit/orbit_08_insurance.webp', sortOrder: 11, positionConfig: { leftPercent: 11.2, topPercent: 58.0 }, animationConfig: { variant: 'c', delaySeconds: -1.41 } },
  { slug: 'sports', title: 'باشگاه و ورزش', imageKey: 'orbit/orbit_12_sports.webp', sortOrder: 12, positionConfig: { leftPercent: 15.4, topPercent: 38.9 }, animationConfig: { variant: 'a', delaySeconds: -2.35 } },
];

async function main() {
  console.log('Seeding categories + services...');
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description, keywords: cat.keywords },
      create: { name: cat.name, description: cat.description, keywords: cat.keywords },
    });

    for (const item of cat.items) {
      const existing = await prisma.service.findFirst({ where: { categoryId: category.id, title: item.title } });
      const data = {
        categoryId: category.id,
        title: item.title,
        groupLabel: item.group,
        subtitle: item.subtitle,
        badge: item.badge,
        icon: item.icon,
        priceLabel: item.priceLabel,
        availableMethods: inferMethods(item.badge),
        benefits: [],
        galleryKeys: [],
        faq: [],
        tags: [],
      };
      if (existing) {
        await prisma.service.update({ where: { id: existing.id }, data });
      } else {
        await prisma.service.create({ data });
      }
    }
  }

  console.log('Seeding membership plans...');
  for (const [i, plan] of [...corePlans, ...tierPlans].entries()) {
    const categoryConnect = 'categoryNames' in plan && plan.categoryNames.length > 0
      ? { connect: plan.categoryNames.map((name) => ({ name })) }
      : undefined;

    const data = {
      kind: plan.kind,
      tier: plan.tier ?? null,
      title: plan.title,
      kicker: plan.kicker,
      shortDescription: plan.shortDescription,
      description: plan.description,
      level: plan.level,
      creditLabel: plan.creditLabel,
      durationLabel: plan.durationLabel,
      priceLabel: plan.priceLabel,
      accentColor: plan.accentColor,
      deepColor: plan.deepColor,
      activationActionLabel: plan.activationActionLabel,
      benefits: plan.benefits,
      terms: plan.terms,
      sortOrder: 'sortOrder' in plan ? plan.sortOrder : i,
      ...(categoryConnect ? { accessibleCategories: categoryConnect } : {}),
    };

    const existing = await prisma.membershipPlan.findFirst({ where: { title: plan.title } });
    if (existing) {
      await prisma.membershipPlan.update({ where: { id: existing.id }, data });
    } else {
      await prisma.membershipPlan.create({ data });
    }
  }

  console.log('Seeding rewards...');
  for (const reward of rewards) {
    const existing = await prisma.reward.findFirst({ where: { title: reward.title } });
    if (existing) {
      await prisma.reward.update({ where: { id: existing.id }, data: reward });
    } else {
      await prisma.reward.create({ data: reward });
    }
  }

  console.log('Seeding orbit items...');
  for (const item of orbitItems) {
    const existing = await prisma.orbitItem.findFirst({ where: { slug: item.slug } });
    const data = {
      slug: item.slug,
      title: item.title,
      imageKey: item.imageKey,
      sortOrder: item.sortOrder,
      positionConfig: item.positionConfig,
      animationConfig: item.animationConfig,
    };
    if (existing) {
      await prisma.orbitItem.update({ where: { id: existing.id }, data });
    } else {
      await prisma.orbitItem.create({ data });
    }
  }

  console.log('Seeding first SUPER_ADMIN...');
  // Stage 5.16 / docs/admin-architecture-decision-record.md §10 step 1 —
  // "One seed script must create the first SUPER_ADMIN AdminUser (credentials
  // via environment variable at seed time, never hardcoded/committed) —
  // without this, migration 1 would ship an auth system nobody can log
  // into." Skips silently (not a hard failure) when the env vars aren't set,
  // since ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are optional in env.validation.ts
  // precisely so CI/tests that never run this script don't need a real
  // admin password.
  const adminSeedEmail = process.env.ADMIN_SEED_EMAIL;
  const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminSeedEmail && adminSeedPassword) {
    const passwordHash = await hashPassword(adminSeedPassword);
    await prisma.adminUser.upsert({
      where: { email: adminSeedEmail },
      update: {},
      create: {
        email: adminSeedEmail,
        passwordHash,
        fullName: process.env.ADMIN_SEED_FULL_NAME ?? 'Biawin Admin',
        role: 'SUPER_ADMIN',
      },
    });
  } else {
    console.log('  Skipped: ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set.');
  }

  console.log('Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
