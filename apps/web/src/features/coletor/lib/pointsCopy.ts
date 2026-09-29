// Nível é só apresentação: a API devolve saldo e extrato, não um nível. Faixas fixas no front.
export interface Level {
  label: string;
  next: number | null;
}

const TIERS: Array<{ min: number; label: string }> = [
  { min: 0, label: 'Iniciante' },
  { min: 50, label: 'Bronze' },
  { min: 150, label: 'Prata' },
  { min: 300, label: 'Ouro' },
];

export function levelFor(balance: number): Level {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (balance >= tier.min) current = tier;
  }
  const next = TIERS.find((tier) => tier.min > balance);
  return { label: current.label, next: next ? next.min : null };
}
