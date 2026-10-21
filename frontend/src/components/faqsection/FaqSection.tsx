import { useState } from "react";
import { Link } from "react-router-dom";
import "./FaqSection.css";

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: "Насколько безопасен софт и есть ли защита от блокировок аккаунта?",
    answer:
      "Мы используем уникальные методы обхода античитов и регулярно обновляем защиту в течение нескольких часов после выхода патчей игры. Статистика показывает минимальный риск, а для вашей безопасности мы рекомендуем следовать нашим инструкциям по настройке и не выставлять настройки на максимум сразу после установки.",
  },
  {
    question: "Как быстро я получу ключ или доступ после оплаты?",
    answer:
      "Доступ выдается автоматически мгновенно после подтверждения транзакции: ключ отображается на экране и дублируется на вашу электронную почту. Если письмо не пришло в течение 2–3 минут, просто напишите нам в поддержку, и мы вручим доступ вручную за пару минут.",
  },
  {
    question: "Гарантируете ли вы возврат средств, если продукт не подойдет или не запустится?",
    answer:
      "Да, если софт технически не работает на вашем компьютере или не совместим с вашей версией игры, мы вернем полную стоимость заказа. Для этого достаточно обратиться в поддержку в течение 24 часов с момента покупки и предоставить скриншот ошибки — мы не задаем лишних вопросов и ценим ваше время.",
  },
  {
    question: "Предоставляете ли вы техническую поддержку в случае возникновения проблем с установкой?",
    answer:
      "Наша команда поддержки работает ежедневно и помогает решить любые вопросы: от настройки файлов исключения в антивирусе до помощи с запуском. Просто опишите проблему в чате на сайте или в Telegram, и мы пришлем персональную инструкцию или видеогайд именно под ваш случай.",
  },
  {
    question: "Какие способы оплаты доступны и защищены ли мои платежные данные?",
    answer:
      "Мы принимаем карты, криптовалюту и популярные электронные кошельки через проверенные шлюзы, которые не хранят данные ваших карт на нашем сервере. Все транзакции проходят по защищенному протоколу, поэтому ваши финансовые данные остаются конфиденциальными и недоступны третьим лицам.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section className="newhome-section newhome-section--faq">
      <div className="newhome-faq">
        <div className="newhome-faq__content">
          <h2 className="newhome-faq__title">ЧАСТЫЕ ВОПРОСЫ</h2>
          <p className="newhome-faq__subtitle">
            Не рискуйте своими деньгами и временем — выбирайте наше программное обеспечение и
            наши гарантии позаботятся о вашем успехе!
          </p>

          <div id="faqList" className="newhome-faq__list">
            {faqItems.map((item, index) => {
              const isOpen = openIndex === index;
              const panelId = `faq-panel-${index}`;

              return (
                <article
                  key={item.question}
                  className={`newhome-faq-item ${isOpen ? "is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="newhome-faq-item__question"
                    onClick={() => toggle(index)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <span>{item.question}</span>

                    <span className="newhome-faq-item__arrow" aria-hidden="true">
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                        <path
                          d="M9 5l7 7-7 7"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  <div id={panelId} className="newhome-faq-item__answer-wrap">
                    <div className="newhome-faq-item__answer">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="newhome-faq__visual">
          <div className="newhome-faq__image-wrap">
            <img
              src="/img/faq.png"
              alt="FAQ"
              className="newhome-faq__image"
              draggable={false}
            />
          </div>

          <div className="newhome-faq-btn-wrap">
            <Link to="/blogs" className="newhome-faq-blog-btn">
              <span>УЗНАТЬ БОЛЬШЕ</span>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}