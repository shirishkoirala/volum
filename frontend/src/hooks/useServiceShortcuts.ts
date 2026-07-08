import { useState, useEffect, useCallback } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  listServices,
  listServiceHealth,
  createService,
  updateService as apiUpdateService,
  deleteService,
  reorderServices as apiReorderServices,
} from '../api/client';
import type { ServiceHealthResult, ServiceShortcut } from '../utils/services';

export function useServiceShortcuts() {
  const [services, setServices] = useState<ServiceShortcut[]>([]);
  const [health, setHealth] = useState<Record<string, ServiceHealthResult>>({});

  const { data, loading } = useAsyncData(() => listServices());

  useEffect(() => {
    if (!data) return;
    const mapped: ServiceShortcut[] = data.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      iconUrl: s.iconUrl || undefined,
      healthUrl: s.healthUrl || undefined,
      description: s.description || undefined,
      openMode: s.openMode === 'tab' ? 'tab' : 'embed',
      lastHealthStatus: s.lastHealthStatus || undefined,
      lastHealthCheckedAt: s.lastHealthCheckedAt || undefined,
      lastHealthStatusCode: s.lastHealthStatusCode || undefined,
      lastHealthError: s.lastHealthError || undefined,
    }));
    setServices(mapped);
    const healthMap: Record<string, ServiceHealthResult> = {};
    for (const svc of mapped) {
      if (svc.lastHealthStatus) {
        healthMap[svc.id] = {
          serviceId: svc.id,
          status: svc.lastHealthStatus as ServiceHealthResult['status'],
          checkedAt: svc.lastHealthCheckedAt ?? '',
          statusCode: svc.lastHealthStatusCode,
          error: svc.lastHealthError,
        };
      }
    }
    setHealth(healthMap);
  }, [data]);

  const refreshHealth = useCallback(async () => {
    const data = await listServiceHealth();
    setHealth(data);
    return data;
  }, []);

  const addService = useCallback(async (svc: ServiceShortcut) => {
    const created = await createService(
      svc.name,
      svc.url,
      svc.iconUrl,
      svc.healthUrl,
      svc.description,
      svc.openMode,
    );
    const entry: ServiceShortcut = {
      id: created.id,
      name: created.name,
      url: created.url,
      iconUrl: created.iconUrl || undefined,
      healthUrl: created.healthUrl || undefined,
      description: created.description || undefined,
      openMode: created.openMode === 'tab' ? 'tab' : 'embed',
    };
    setServices((prev) => [...prev, entry]);
    return entry;
  }, []);

  const updateService = useCallback(async (id: string, updates: Partial<ServiceShortcut>) => {
    const updated = await apiUpdateService(
      id,
      updates.name ?? '',
      updates.url ?? '',
      updates.iconUrl ?? '',
      updates.healthUrl ?? '',
      updates.description,
      updates.openMode,
    );
    setServices((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              id: updated.id,
              name: updated.name,
              url: updated.url,
              iconUrl: updated.iconUrl || undefined,
              healthUrl: updated.healthUrl || undefined,
              description: updated.description || undefined,
              openMode: updated.openMode === 'tab' ? 'tab' : 'embed',
            }
          : s,
      ),
    );
    return updated;
  }, []);

  const removeService = useCallback(async (id: string) => {
    await deleteService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    setHealth((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const reorderServices = useCallback(async (ids: string[]) => {
    await apiReorderServices(ids);
    setServices((prev) => {
      const ordered = ids
        .map((id) => prev.find((s) => s.id === id))
        .filter(Boolean) as ServiceShortcut[];
      return ordered;
    });
  }, []);

  return {
    services,
    health,
    loading,
    addService,
    updateService,
    removeService,
    reorderServices,
    refreshHealth,
  };
}
