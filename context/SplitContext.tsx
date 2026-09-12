// context/SplitContext.tsx
// Owns the basket history + the in-progress "Split Engine" step machine
// (Create Basket -> Add Payers -> QR & Bill -> Dispatch).

import React, { createContext, useContext, useState, useCallback } from 'react';
import * as api from '../services/api';
import { Basket, BasketItem } from '../types';
import { useAuth } from './AuthContext';

export type SplitEngineStep = 'create' | 'payers' | 'qr' | 'dispatch' | null;

interface DraftBasket {
  title: string;
  totalMarketCost: number;
  items: BasketItem[];
  payerHandles: { name: string; splitId?: string }[];
}

const emptyDraft: DraftBasket = {
  title: '',
  totalMarketCost: 0,
  items: [],
  payerHandles: [],
};

interface SplitContextValue {
  baskets: Basket[];
  isLoadingBaskets: boolean;
  activeStep: SplitEngineStep;
  draft: DraftBasket;
  finalizedBasket: Basket | null;
  isSubmitting: boolean;
  error: string | null;

  openSplitEngine: () => void;
  closeSplitEngine: () => void;
  updateDraftBasics: (fields: Partial<Pick<DraftBasket, 'title' | 'totalMarketCost'>>) => void;
  addItem: (item: BasketItem) => void;
  removeItem: (id: string) => void;
  addPayer: (payer: { name: string; splitId?: string }) => void;
  removePayer: (index: number) => void;
  goToStep: (step: SplitEngineStep) => void;
  finalizeBasket: (adminId: string) => Promise<Basket>;
  lookupByTextCode: (code: string) => Promise<Basket | null>;
}

const SplitContext = createContext<SplitContextValue | undefined>(undefined);

export const SplitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [isLoadingBaskets, setIsLoadingBaskets] = useState(true);
  const [activeStep, setActiveStep] = useState<SplitEngineStep>(null);
  const [draft, setDraft] = useState<DraftBasket>(emptyDraft);
  const [finalizedBasket, setFinalizedBasket] = useState<Basket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSplitEngine = useCallback(() => {
    setDraft(emptyDraft);
    setFinalizedBasket(null);
    setError(null);
    setActiveStep('create');
  }, []);

  const closeSplitEngine = useCallback(() => {
    setActiveStep(null);
  }, []);

  React.useEffect(() => {
    if (!token) {
      setBaskets([]);
      setIsLoadingBaskets(false);
      return;
    }

    setIsLoadingBaskets(true);
    api
      .listBaskets(token)
      .then(setBaskets)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load baskets');
      })
      .finally(() => setIsLoadingBaskets(false));
  }, [token]);

  const updateDraftBasics = useCallback((fields: Partial<Pick<DraftBasket, 'title' | 'totalMarketCost'>>) => {
    setDraft((prev) => ({ ...prev, ...fields }));
  }, []);

  const addItem = useCallback((item: BasketItem) => {
    setDraft((prev) => ({ ...prev, items: [...prev.items, item] }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
  }, []);

  const addPayer = useCallback((payer: { name: string; splitId?: string }) => {
    setDraft((prev) => ({ ...prev, payerHandles: [...prev.payerHandles, payer] }));
  }, []);

  const removePayer = useCallback((index: number) => {
    setDraft((prev) => ({ ...prev, payerHandles: prev.payerHandles.filter((_, i) => i !== index) }));
  }, []);

  const goToStep = useCallback((step: SplitEngineStep) => {
    setActiveStep(step);
  }, []);

  const finalizeBasket = useCallback(
    async (adminId: string) => {
      setIsSubmitting(true);
      setError(null);
      try {
        if (!draft.title.trim()) throw new Error('Give your basket a name');
        if (draft.totalMarketCost <= 0) throw new Error('Total market cost must be greater than 0');
        if (draft.payerHandles.length === 0) throw new Error('Add at least one payer');
        if (!token) throw new Error('You must be logged in to create a basket');

        const basket = await api.createBasket({
          title: draft.title,
          items: draft.items,
          totalMarketCost: draft.totalMarketCost,
          payerHandles: draft.payerHandles,
          adminId,
          token,
        });
        setBaskets((prev) => [basket, ...prev]);
        setFinalizedBasket(basket);
        setActiveStep('qr');
        return basket;
      } catch (e: any) {
        setError(e?.message ?? 'Could not create basket');
        throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [draft, token]
  );

  const lookupByTextCode = useCallback(
    async (code: string) => api.lookupBasketByTextCode(code, baskets),
    [baskets]
  );

  return (
    <SplitContext.Provider
      value={{
        baskets,
        isLoadingBaskets,
        activeStep,
        draft,
        finalizedBasket,
        isSubmitting,
        error,
        openSplitEngine,
        closeSplitEngine,
        updateDraftBasics,
        addItem,
        removeItem,
        addPayer,
        removePayer,
        goToStep,
        finalizeBasket,
        lookupByTextCode,
      }}
    >
      {children}
    </SplitContext.Provider>
  );
};

export function useSplit(): SplitContextValue {
  const ctx = useContext(SplitContext);
  if (!ctx) throw new Error('useSplit must be used within SplitProvider');
  return ctx;
}
