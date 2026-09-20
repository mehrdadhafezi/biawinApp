import type { CardType, CategoryDto } from "../../lib/services-api";
import { CARD_TYPE_SHORT_LABEL } from "./cardProductPresentation";
import { toPersianDigits } from "./serviceCategoryVisual";

export interface CategoryLandingHeroProps {
  category: CategoryDto;
  /** `null` while the cards are still loading — the count chip is then omitted, never shown as a false "۰". */
  cardCount: number | null;
  /** The real card types present in this category, in display order (see `availableCardTypes`). */
  cardTypes: CardType[];
}

/**
 * The prototype's `.category-hero` — full-bleed rounded hero, gradient
 * scrim, "کارت‌های خدمات بیاوین" label, big title, description, meta chips.
 *
 * Real data only:
 * - Image: the Category's own resolved `image` (Category-level media, the
 *   prototype's `#categoryHeroImage`); without one, the prototype's own
 *   `#0b4d88` background shows under the scrim.
 * - Title/description: the real `Category.name` / `.description`.
 * - Meta chips (prototype: item count / "اقساطی، اعتباری و تخفیفی" / "ویژه
 *   اعضای بیاوین"): the real card count, the real card types present in
 *   this category (the prototype's phrase is a fixed list — here it is what
 *   actually exists), and the prototype's third phrase, unchanged.
 * - The page's `h1` is the category name (the prototype's `h2`); the
 *   prototype's own `h1` is the small header caption (`ServicesPageHeader`).
 */
export function CategoryLandingHero({ category, cardCount, cardTypes }: CategoryLandingHeroProps) {
  const typesLabel = cardTypes.map((t) => CARD_TYPE_SHORT_LABEL[t]).join("، ");
  const chips = [
    ...(cardCount === null ? [] : [`${toPersianDigits(cardCount)} کارت قابل انتخاب`]),
    ...(typesLabel ? [typesLabel] : []),
    "ویژه اعضای بیاوین",
  ];

  return (
    <section className="cl-hero">
      {category.image && <img className="cl-hero-img" src={category.image} alt="" />}
      <div className="cl-hero-copy">
        <span className="cl-hero-label">کارت‌های خدمات بیاوین</span>
        <h1>{category.name}</h1>
        {category.description && <p>{category.description}</p>}
        <div className="cl-hero-meta">
          {chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
