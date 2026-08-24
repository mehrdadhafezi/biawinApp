import { WalletCard, color } from "@biawin/ui";
import { formatToman } from "../../lib/format";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { WalletDto } from "../../lib/wallet-api";

const KIND_LABEL: Record<WalletDto["kind"], string> = {
  main: "اصلی",
  reward: "جایزه",
};

export interface WalletOverviewCardProps {
  kind: WalletDto["kind"];
  /** `null` while loading. */
  wallet: WalletDto | null | undefined;
}

/**
 * One wallet's balance card — built on `WalletCard` (packages/ui),
 * exactly the same composition Home's `AccountFinancialCards` already
 * uses (docs/wallet-ui-contract.md §3's extraction note flags unifying
 * these later; not done now since that touches Home, out of scope here).
 */
export function WalletOverviewCard({ kind, wallet }: WalletOverviewCardProps) {
  if (wallet === undefined) {
    return <SkeletonBlock height={92} radiusPx={24} />;
  }

  return (
    <WalletCard
      chipLabel={KIND_LABEL[kind]}
      balanceLabel={formatToman(wallet?.balance ?? 0)}
      currencyLabel=""
      style={
        kind === "reward"
          ? { background: `linear-gradient(135deg, ${color.accentOrange}, #c96a12)` }
          : undefined
      }
    />
  );
}
