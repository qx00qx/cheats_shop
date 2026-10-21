import React from "react";
import { formatPriceWithSpaces } from "../utils/format";
import { Button } from "./Button";

interface ProductCardProps {
  id: string | number;
  name: string;
  price: number;
  image?: string;
  description?: string;
  onBuyClick?: (product: ProductCardProps) => void;
  onViewClick?: (id: string | number) => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  description,
  onBuyClick,
  onViewClick,
  className = "",
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow ${className}`}>
      {/* Image */}
      {image && (
        <div
          className="w-full h-48 bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: `url(${image})` }}
          onClick={() => onViewClick?.(id)}
        />
      )}

      {/* Content */}
      <div className="p-4">
        <h3
          className="text-lg font-semibold mb-2 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => onViewClick?.(id)}
        >
          {name}
        </h3>

        {description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{description}</p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl font-bold text-blue-600">
            {formatPriceWithSpaces(price)} ₽
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => onBuyClick?.({ id, name, price, image, description })}
          >
            Купить
          </Button>
        </div>
      </div>
    </div>
  );
};

// Компонент для карточки товара в каталоге (с количеством)
interface ProductCatalogCardProps extends Omit<ProductCardProps, 'id'> {
  id: string | number;
  showQuantity?: boolean;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
}

export const ProductCatalogCard: React.FC<ProductCatalogCardProps> = ({
  showQuantity = false,
  quantity = 1,
  onQuantityChange,
  ...props
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      {props.image && (
        <div
          className="w-full h-48 bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: `url(${props.image})` }}
          onClick={() => props.onViewClick?.(props.id)}
        />
      )}

      {/* Content */}
      <div className="p-4">
        <h3
          className="text-lg font-semibold mb-2 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => props.onViewClick?.(props.id)}
        >
          {props.name}
        </h3>

        {props.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{props.description}</p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl font-bold text-blue-600">
            {formatPriceWithSpaces(props.price)} ₽
          </span>
        </div>

        {/* Quantity */}
        {showQuantity && (
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => onQuantityChange?.(Math.max(1, quantity - 1))}
              className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              -
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => onQuantityChange?.(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 text-center border rounded px-2 py-1"
              min="1"
            />
            <button
              onClick={() => onQuantityChange?.(quantity + 1)}
              className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              +
            </button>
          </div>
        )}

        {/* Actions */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => props.onBuyClick?.({ ...props })}
        >
          Купить в 1 клик
        </Button>
      </div>
    </div>
  );
};
