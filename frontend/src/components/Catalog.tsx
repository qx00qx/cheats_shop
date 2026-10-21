import React, { useState, useEffect } from "react";
import { ProductCatalogCard } from "./ProductCard";
import { Button } from "./Button";
import { useApi } from "../hooks/useApi";

interface Product {
  id: number | string;
  name: string;
  price: number;
  image?: string;
  description?: string;
}

interface CatalogProps {
  initialProducts?: Product[];
  loadMoreEndpoint?: string;
  className?: string;
}

type SortType = "name" | "priceup" | "pricedown";

export const Catalog: React.FC<CatalogProps> = ({
  initialProducts = [],
  loadMoreEndpoint = "/ajax/loadmore",
  className = "",
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortType>("name");
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { execute } = useApi();

  const sortProducts = (productsToSort: Product[], sortType: SortType) => {
    const sorted = [...productsToSort];
    switch (sortType) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "priceup":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "pricedown":
        sorted.sort((a, b) => b.price - a.price);
        break;
    }
    return sorted;
  };

  const handleSortChange = (newSort: SortType) => {
    setSort(newSort);
    const sorted = sortProducts(products, newSort);
    setProducts(sorted);
  };

  const handleLoadMore = async () => {
    if (!hasMore || isLoading) return;

    setIsLoading(true);
    try {
      const response = await execute({
        method: "POST",
        data: { page: page + 1 },
        url: loadMoreEndpoint,
      });

      if (response) {
        // В реальном проекте здесь должен быть парсер HTML или API возвращает JSON
        // Сейчас просто предполагаем, что API возвращает массив товаров
        if (Array.isArray(response)) {
          setProducts((prev) => [...prev, ...response]);
          setPage((prev) => prev + 1);
        } else if (response.html) {
          // Если возвращает HTML (как в оригинальном jQuery коде)
          // Парсинг должен быть реализован отдельно
          setProducts((prev) => [...prev, ...response.html]);
          setPage((prev) => prev + 1);

          if (response.last) {
            setHasMore(false);
          }
        }
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyClick = (product: Product) => {
    console.log("Buy product:", product);
    // Здесь можно открыть модальное окно быстрой покупки
  };

  const handleQuantityChange = (productId: string | number, quantity: number) => {
    console.log("Quantity change:", productId, quantity);
    // Обновление количества в корзине
  };

  return (
    <div className={className}>
      {/* Sort Selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 mr-2">
          Сортировка:
        </label>
        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as SortType)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">По названию</option>
          <option value="priceup">Цена по возрастанию</option>
          <option value="pricedown">Цена по убыванию</option>
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCatalogCard
            key={product.id}
            {...product}
            showQuantity
            quantity={1}
            onQuantityChange={(qty) => handleQuantityChange(product.id, qty)}
            onBuyClick={handleBuyClick}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-8 text-center">
          <Button
            onClick={handleLoadMore}
            loading={isLoading}
            variant="secondary"
          >
            Загрузить еще
          </Button>
        </div>
      )}
    </div>
  );
};
