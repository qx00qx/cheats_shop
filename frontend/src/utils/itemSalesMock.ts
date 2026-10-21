export type MockItemSale = {
  email: string;
  created_at: string;
};

export type MockItemSales = {
  purchase_count: number;
  sales: MockItemSale[];
};

const salesByAlias = new Map<string, MockItemSales>();

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

export function getMockItemSales(alias: string): MockItemSales {
  const cached = salesByAlias.get(alias);
  if (cached) return cached;

  const random = createRandom(hashAlias(alias));
  const saleCount = 5 + Math.floor(random() * 6);
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

  const mockSales = {
    purchase_count: 50 + Math.floor(random() * 451),
    sales,
  };
  salesByAlias.set(alias, mockSales);
  return mockSales;
}
