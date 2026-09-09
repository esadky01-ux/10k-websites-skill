import "server-only";
import pricesJson from "./prices.json";

/**
 * Genel satış fiyatları (KDV hariç, koli başına), Odoo dışa aktarımından.
 * Yalnızca sunucu tarafında ve kimliği doğrulanmış istemciler için okunur;
 * istemci paketine dahil edilmez. Odoo bağlantısında müşteri fiyat listesiyle değiştirilir.
 */
const prices = pricesJson as Record<string, number>;

export function getPricesForCustomer(_pricelist?: string): Record<string, number> {
  void _pricelist;
  return prices;
}

export function priceOf(productId: string): number | undefined {
  return prices[productId];
}
