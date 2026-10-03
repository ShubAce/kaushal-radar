import { ConsoleShell } from "@/components/shell/console-shell";
import { flags, geo, meta, taxonomy } from "@/lib/data";
import { RefProvider } from "@/lib/ref";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const g = geo();
  const tx = taxonomy();
  return (
    <RefProvider
      value={{
        meta: meta(),
        states: g.states,
        districts: g.districts,
        sectors: tx.sectors,
        trades: tx.trades,
        criticalFlags: flags({ severity: "critical" }).length,
      }}
    >
      <ConsoleShell>{children}</ConsoleShell>
    </RefProvider>
  );
}
