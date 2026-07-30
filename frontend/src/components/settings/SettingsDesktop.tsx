import { useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, IconButton, MutedText } from '../ui/shared';
import type { ServiceShortcut, ServiceHealthResult } from '../../utils/services';
import styles from '../../pages/SettingsPanel.module.css';

type SettingsDesktopProps = {
  services?: ServiceShortcut[];
  serviceHealth?: Record<string, ServiceHealthResult>;
  onAddService?: () => void;
  onEditService?: (id: string) => void;
  onRemoveService?: (id: string) => void;
  onReorderServices?: (ids: string[]) => Promise<void>;
};

export function SettingsDesktop({
  services,
  serviceHealth,
  onAddService,
  onEditService,
  onRemoveService,
  onReorderServices,
}: SettingsDesktopProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleRemove = async (id: string) => {
    setBusyServiceId(id);
    setActionError(null);
    try {
      await onRemoveService?.(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove service.');
    } finally {
      setBusyServiceId(null);
    }
  };

  const handleReorder = async (ids: string[]) => {
    setReordering(true);
    setActionError(null);
    try {
      await onReorderServices?.(ids);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reorder services.');
    } finally {
      setReordering(false);
    }
  };

  const moveService = (fromIndex: number, toIndex: number) => {
    if (!services || toIndex < 0 || toIndex >= services.length) return;
    const ids = services.map((service) => service.id);
    const [moved] = ids.splice(fromIndex, 1);
    if (!moved) return;
    ids.splice(toIndex, 0, moved);
    void handleReorder(ids);
  };

  return (
    <>
      {onAddService && (
        <section className={styles.settingsSection}>
          <h4>Services</h4>
          {services && services.length > 0 ? (
            <div className={styles.serviceList}>
              {services.map((svc, idx) => (
                <div
                  key={svc.id}
                  className={`${styles.serviceRow}${dragIndex === idx ? ` ${styles.dragging}` : ''}${dropIndex === idx ? ` ${styles.dragOver}` : ''}`}
                  draggable={!reordering && busyServiceId === null}
                  onDragStart={() => {
                    setDragIndex(idx);
                    dragOverIndex.current = null;
                  }}
                  onDragEnd={() => {
                    const toIdx = dragOverIndex.current;
                    const fromIdx = dragIndex;
                    if (toIdx !== null && fromIdx !== null && toIdx !== fromIdx) {
                      const ids = [...services.map((s) => s.id)];
                      const moved = ids[fromIdx];
                      if (!moved) return;
                      ids.splice(fromIdx, 1);
                      ids.splice(toIdx, 0, moved);
                      void handleReorder(ids);
                    }
                    setDragIndex(null);
                    setDropIndex(null);
                    dragOverIndex.current = null;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropIndex !== idx) setDropIndex(idx);
                    dragOverIndex.current = idx;
                  }}
                  onDragLeave={() => {
                    setDropIndex(null);
                  }}
                >
                  <div className={styles.serviceDragHandle}>
                    <Icon name="drag-handle" size={14} />
                  </div>
                  <div className={styles.serviceInfo}>
                    <span>{svc.name}</span>
                    <span className={styles.serviceHealth}>
                      {(() => {
                        const h = serviceHealth?.[svc.id];
                        if (!h) return '⋯';
                        return h.status === 'healthy'
                          ? '✓ Healthy'
                          : h.status === 'unhealthy'
                            ? '✗ Unhealthy'
                            : '⋯ Checking';
                      })()}
                    </span>
                  </div>
                  <div className={styles.serviceActions}>
                    <IconButton
                      aria-label={`Move ${svc.name} up`}
                      disabled={idx === 0 || busyServiceId !== null || reordering}
                      onClick={() => moveService(idx, idx - 1)}
                      title="Move up"
                    >
                      <Icon name="go-up" size={15} />
                    </IconButton>
                    <IconButton
                      aria-label={`Move ${svc.name} down`}
                      disabled={idx === services.length - 1 || busyServiceId !== null || reordering}
                      onClick={() => moveService(idx, idx + 1)}
                      title="Move down"
                    >
                      <Icon name="go-down" size={15} />
                    </IconButton>
                    <Button
                      size="compact"
                      disabled={busyServiceId !== null || reordering}
                      onClick={() => onEditService?.(svc.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="compact"
                      disabled={busyServiceId !== null || reordering}
                      onClick={() => void handleRemove(svc.id)}
                    >
                      {busyServiceId === svc.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MutedText compact>
              No services configured. Add shortcuts to your favorite web apps.
            </MutedText>
          )}
          {actionError && (
            <p className={styles.serviceActionError} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.settingsActions}>
            <Button
              size="compact"
              disabled={busyServiceId !== null || reordering}
              onClick={onAddService}
            >
              Add Service
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
