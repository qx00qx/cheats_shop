import { create } from "zustand";

interface ModalState {
  isOpen: boolean;
  content: React.ReactNode | null;
  title: string | null;
  openModal: (content: React.ReactNode, title?: string) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  content: null,
  title: null,
  openModal: (content, title = '')=>
    set({ isOpen: true, content, title }),
  closeModal: () => set({ isOpen: false, content: null, title: null }),
}));

export const useModal = () => {
  const { isOpen, content, title, openModal, closeModal } = useModalStore();

  return {
    isOpen,
    content,
    title,
    openModal,
    closeModal,
  };
};
