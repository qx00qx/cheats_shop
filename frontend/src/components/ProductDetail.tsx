import React, { useState } from "react";
import { formatPriceWithSpaces } from "../utils/format";
import { Button } from "./Button";
import { Input, TextArea } from "./Input";
import { useModal } from "../hooks/useModal";
import { useToast } from "../hooks/useToast";

interface ProductDetailProps {
  id: string | number;
  name: string;
  price: number;
  description?: string;
  image?: string;
  screenshots?: string[];
  characteristics?: Record<string, string>;
  onAddToCart?: (quantity: number) => void;
  onBuyOneClick?: (data: { name: string; quantity: number; price: string }) => void;
  className?: string;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  id,
  name,
  price,
  description,
  image,
  screenshots = [],
  characteristics = {},
  onAddToCart,
  onBuyOneClick,
  className = "",
}) => {
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "characteristics">("description");
  const { openModal } = useModal();
  const { success, error } = useToast();

  const handleQuantityChange = (value: number) => {
    setQuantity(Math.max(1, value));
  };

  const handleAddToCart = () => {
    onAddToCart?.(quantity);
    success("Товар добавлен в корзину");
  };

  const handleBuyOneClick = () => {
    const data = {
      name,
      quantity,
      price: formatPriceWithSpaces(price),
    };

    // Открываем модальное окно быстрой покупки
    openModal(
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded">
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-gray-600">Количество: {quantity}</p>
          <p className="text-lg font-bold text-blue-600">
            {formatPriceWithSpaces(price * quantity)} ₽
          </p>
        </div>

        <Input
          name="phone"
          type="tel"
          label="Телефон"
          placeholder="+7 (999) 999-99-99"
          required
          fullWidth
        />

        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="example@mail.com"
          required
          fullWidth
        />

        <Button
          fullWidth
          onClick={() => {
            onBuyOneClick?.(data);
            // Здесь должна быть логика отправки формы
          }}
        >
          Оформить заказ
        </Button>
      </div>,
      "Быстрая покупка"
    );
  };

  const scrollToCharacteristics = () => {
    setActiveTab("characteristics");
    const element = document.getElementById("characteristics");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        {/* Images */}
        <div className="space-y-4">
          {image && (
            <div
              className="w-full aspect-square bg-cover bg-center rounded-lg"
              style={{ backgroundImage: `url(${image})` }}
            />
          )}
          {screenshots.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {screenshots.map((screenshot, index) => (
                <div
                  key={index}
                  className="aspect-square bg-cover bg-center rounded cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundImage: `url(${screenshot})` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{name}</h1>
            <p className="text-2xl font-bold text-blue-600">
              {formatPriceWithSpaces(price)} ₽
            </p>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Количество:</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuantityChange(quantity - 1)}
                className="w-10 h-10 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                className="w-20 text-center border rounded-lg px-3 py-2 text-lg"
                min="1"
              />
              <button
                onClick={() => handleQuantityChange(quantity + 1)}
                className="w-10 h-10 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button variant="primary" fullWidth onClick={handleAddToCart}>
              В корзину
            </Button>
            <Button variant="secondary" fullWidth onClick={handleBuyOneClick}>
              Купить в 1 клик
            </Button>
          </div>

          {/* All Settings Button */}
          <Button variant="ghost" onClick={scrollToCharacteristics}>
            Все характеристики
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("description")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "description"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Описание
          </button>
          <button
            onClick={() => setActiveTab("characteristics")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "characteristics"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Характеристики
          </button>
        </div>

        <div className="p-6">
          {activeTab === "description" && description && (
            <div className="prose max-w-none">
              <p>{description}</p>
            </div>
          )}

          {activeTab === "characteristics" && (
            <div id="characteristics" className="space-y-2">
              {Object.entries(characteristics).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">{key}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
