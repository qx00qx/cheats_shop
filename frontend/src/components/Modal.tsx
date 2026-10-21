import React, { useEffect } from "react";
import { useModalStore } from "../hooks/useModal";
import "../static/styles/components/modal.css";

export const Modal: React.FC = () => {
  const { isOpen, content, title, closeModal } = useModalStore();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeModal();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  return (
    <div
      className="millex-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        className="millex-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Диалог"}
      >
        {title && (
          <header className="millex-modal-header">
            <div>
              <span className="millex-modal-eyebrow">MILLEX MARKET</span>
              <h2>{title}</h2>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="millex-modal-close"
              aria-label="Закрыть"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
        )}

        <div className="millex-modal-body">{content}</div>
      </div>
    </div>
  );
};

// Компонент для управления модальным окном через children
interface ModalWrapperProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  title?: string;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  trigger,
  content,
  title,
}) => {
  const { openModal, closeModal } = useModalStore();

  const handleOpen = () => {
    openModal(content, title);
  };

  return (
    <>
      <div onClick={handleOpen}>{trigger}</div>
    </>
  );
};
