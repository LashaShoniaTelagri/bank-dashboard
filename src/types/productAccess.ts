export enum ProductAccess {
  FieldMonitoring = 1,   // bit 0
  Underwriting = 2,      // bit 1
}

export const PRODUCT_LABELS: Record<ProductAccess, string> = {
  [ProductAccess.FieldMonitoring]: 'Field Monitoring',
  [ProductAccess.Underwriting]: 'Underwriting',
};

export const ALL_PRODUCTS = [
  ProductAccess.FieldMonitoring,
  ProductAccess.Underwriting,
] as const;

export function hasProductAccess(productsEnabled: number, product: ProductAccess): boolean {
  return (productsEnabled & product) > 0;
}

export function grantProduct(productsEnabled: number, product: ProductAccess): number {
  return productsEnabled | product;
}

export function revokeProduct(productsEnabled: number, product: ProductAccess): number {
  return productsEnabled & ~product;
}

export function getEnabledProducts(productsEnabled: number): ProductAccess[] {
  return ALL_PRODUCTS.filter((p) => hasProductAccess(productsEnabled, p));
}
