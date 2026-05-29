import { useState, useCallback } from 'react';
import { loadServices, saveServices, type ServiceShortcut } from '../utils/services';

export function useServiceShortcuts() {
  const [services, setServices] = useState<ServiceShortcut[]>(loadServices);

  const persist = useCallback((next: ServiceShortcut[]) => {
    setServices(next);
    saveServices(next);
  }, []);

  const addService = useCallback((svc: ServiceShortcut) => {
    persist([...services, svc]);
  }, [services, persist]);

  const updateService = useCallback((id: string, updates: Partial<ServiceShortcut>) => {
    persist(services.map((s) => s.id === id ? { ...s, ...updates } : s));
  }, [services, persist]);

  const removeService = useCallback((id: string) => {
    persist(services.filter((s) => s.id !== id));
  }, [services, persist]);

  return { services, addService, updateService, removeService };
}
