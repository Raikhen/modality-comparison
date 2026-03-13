const DOMAIN_HUES: Record<string, string> = {
  "Political Violence & Terrorism": "0",
  "Cybercrime": "270",
  "Hate Speech": "25",
  "CSAM": "340",
  "Self-Harm": "45",
  "Weapons": "35",
  "Fraud": "230",
  "Drugs": "150",
  "Privacy": "180",
};

export function DomainBadge({ domain }: { domain: string }) {
  const hue = DOMAIN_HUES[domain] ?? "210";

  return (
    <span
      className="inline-block px-1.5 py-px text-[11px] font-mono font-medium rounded-sm uppercase tracking-wider"
      style={{
        background: `hsl(${hue} 25% 93%)`,
        color: `hsl(${hue} 30% 40%)`,
        border: `1px solid hsl(${hue} 20% 85%)`,
      }}
    >
      {domain}
    </span>
  );
}
