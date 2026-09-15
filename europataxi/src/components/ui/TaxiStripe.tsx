/**
 * Markanın tek güçlü vurgu öğesi: sarı-siyah dama deseni şeridi (taksi tabelası hissi).
 * Dekoratiftir, ekran okuyucudan gizlenir. Tüm sitede ölçülü kullanın.
 */
export function TaxiStripe({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`taxi-stripe h-3 w-full ${className}`} />;
}
