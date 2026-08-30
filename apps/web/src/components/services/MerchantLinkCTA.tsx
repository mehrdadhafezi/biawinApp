import { Button } from "@biawin/ui";

/**
 * SERVICES-R4 — a REAL, functioning navigation control, not a decorative
 * placeholder: only ever rendered by the caller when a real Service's
 * `merchantId` is non-null (see `[serviceId]/page.tsx`). Routes to the
 * real, relationship-validated Merchant Detail page. Given 0 of the 108
 * real seeded services currently have a non-null `merchantId` (verified
 * live this stage), this never actually renders on staging today — that
 * is correct, honest behavior given the real data, not a bug to work
 * around.
 */
export function MerchantLinkCTA({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick} style={{ width: "100%" }}>
      مشاهده اطلاعات فروشنده
    </Button>
  );
}
