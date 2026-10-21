export {};

declare global {
  interface Window {
    jivo_api?: {
      setContactInfo?: (data: {
        name?: string;
        email?: string;
        phone?: string;
      }) => void;
      open?: () => void;
      close?: () => void;
    };
  }
}