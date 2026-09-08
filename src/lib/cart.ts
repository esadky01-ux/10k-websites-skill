export type DeliveryType = "adres" | "depo";

export type CartLine = {
  productId: string;
  cases: number;
  units: number;
};

export const DELIVERY_LABELS: Record<DeliveryType, string> = {
  adres: "Adrese Teslimat",
  depo: "Depodan Teslim Alma (-%15)",
};
