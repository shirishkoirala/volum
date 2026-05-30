import { useState, useEffect, useCallback } from 'react';
import { listServices, createService, updateService as apiUpdateService, deleteService } from '../api/client';
import type { ServiceShortcut } from '../utils/services';

export function useServiceShortcuts() {
  const [services, setServices] = useState<ServiceShortcut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listServices()
      .then(data => setServices(data.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        iconUrl: s.iconUrl || undefined,
      }))))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  const addService = useCallback(async (svc: ServiceShortcut) => {
    const created = await createService(svc.name, svc.url, svc.iconUrl);
    const entry: ServiceShortcut = {
      id: created.id,
      name: created.name,
      url: created.url,
      iconUrl: created.iconUrl || undefined,
    };
    setServices(prev => [...prev, entry]);
    return entry;
  }, []);

  const updateService = useCallback(async (id: string, updates: Partial<ServiceShortcut>) => {
    const updated = await apiUpdateService(id, updates.name ?? '', updates.url ?? '', updates.iconUrl ?? '');
    setServices(prev => prev.map(s => s.id === id ? { ...s, id: updated.id, name: updated.name, url: updated.url, iconUrl: updated.iconUrl || undefined } : s));
    return updated;
  }, []);

  const removeService = useCallback(async (id: string) => {
    await deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  return { services, loading, addService, updateService, removeService };
}
