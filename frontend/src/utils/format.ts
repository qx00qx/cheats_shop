export const formatPrice = (v: number | string) =>
  `${Number(v).toFixed(2).replace(/\.00$/, "")} ₽`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Форматирование чисел с разделителями (аналог numberFormat из app.js)
export const formatNumber = (
  num: number | string,
  decimals: number = 0,
  decPoint: string = ",",
  thousandsSep: string = " "
): string => {
  const n = Number(num);
  if (isNaN(n)) return "0";

  const fixed = n.toFixed(decimals);
  const parts = fixed.split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1] || "";

  // Добавляем разделители тысяч
  let formatted = "";
  let count = 0;
  for (let i = integerPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      formatted = thousandsSep + formatted;
    }
    formatted = integerPart[i] + formatted;
    count++;
  }

  // Добавляем десятичную часть
  if (decimals > 0 && decimalPart) {
    formatted += decPoint + decimalPart;
  }

  return formatted;
};

// Форматирование цены с пробелами (как в оригинале)
export const formatPriceWithSpaces = (price: number | string): string => {
  return formatNumber(price, 0, "", " ");
};