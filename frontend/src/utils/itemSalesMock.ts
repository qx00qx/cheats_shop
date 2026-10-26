export type MockItemSale = {
  email: string;
  created_at: string;
};

export type MockItemSales = {
  purchase_count: number;
  sales: MockItemSale[];
};

type CachedMockItemSales = MockItemSales & {
  defaultSalesCount: number;
};

const salesByAlias = new Map<string, CachedMockItemSales>();

function createRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashAlias(alias: string): number {
  let hash = 2166136261;
  for (let index = 0; index < alias.length; index += 1) {
    hash ^= alias.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getMockItemSales(alias: string, salesLimit?: number): MockItemSales {
  const cached = salesByAlias.get(alias);
  if (cached) {
    return {
      purchase_count: cached.purchase_count,
      sales: cached.sales.slice(0, salesLimit ?? cached.defaultSalesCount),
    };
  }

  const random = createRandom(hashAlias(alias));
  const defaultSalesCount = 5 + Math.floor(random() * 6);
  const saleCount = Math.max(defaultSalesCount, 16);
  const sales = Array.from({ length: saleCount }, () => {
    const local = Array.from({ length: 8 }, () =>
      String.fromCharCode(97 + Math.floor(random() * 26)),
    ).join("");
    const minutesAgo = Math.floor(random() * 14 * 24 * 60);

    return {
      email: `${local.slice(0, 2)}****@.ru`,
      created_at: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
    };
  }).sort((first, second) =>
    new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  );

  const mockSales: CachedMockItemSales = {
    purchase_count: 50 + Math.floor(random() * 451),
    sales,
    defaultSalesCount,
  };
  salesByAlias.set(alias, mockSales);
  return {
    purchase_count: mockSales.purchase_count,
    sales: mockSales.sales.slice(0, salesLimit ?? defaultSalesCount),
  };
}
