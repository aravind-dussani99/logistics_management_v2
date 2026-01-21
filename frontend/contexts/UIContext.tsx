
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';

interface ModalState {
  title: string;
  content: React.ReactNode;
}

interface UIContextType {
  isModalOpen: boolean;
  modalContent: ModalState | null;
  openModal: (title: string, content: React.ReactNode) => void;
  closeModal: () => void;
  confirm: (title: string, message: React.ReactNode, options?: { confirmText?: string; cancelText?: string }) => Promise<boolean>;
  alert: (title: string, message: React.ReactNode, options?: { confirmText?: string }) => Promise<void>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const openModal = useCallback((title: string, content: React.ReactNode) => {
    setModalState({ title, content });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(null);
  }, []);

  const confirm = useCallback((title: string, message: React.ReactNode, options?: { confirmText?: string; cancelText?: string }) => {
    return new Promise<boolean>((resolve) => {
      const handleConfirm = () => {
        resolve(true);
        closeModal();
      };
      const handleCancel = () => {
        resolve(false);
        closeModal();
      };
      openModal(
        title,
        <ConfirmDialog
          message={message}
          confirmText={options?.confirmText}
          cancelText={options?.cancelText}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />,
      );
    });
  }, [openModal, closeModal]);

  const alert = useCallback((title: string, message: React.ReactNode, options?: { confirmText?: string }) => {
    return new Promise<void>((resolve) => {
      const handleConfirm = () => {
        resolve();
        closeModal();
      };
      openModal(
        title,
        <AlertDialog
          message={message}
          confirmText={options?.confirmText}
          onConfirm={handleConfirm}
        />,
      );
    });
  }, [openModal, closeModal]);

  const value = {
    isModalOpen: !!modalState,
    modalContent: modalState,
    openModal,
    closeModal,
    confirm,
    alert,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
