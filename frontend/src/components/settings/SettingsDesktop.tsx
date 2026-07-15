import { useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Button, MutedText } from '../ui/shared';
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
  const dragOverIndex = useRef<number | null>(null);

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
                  draggable
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
                      onReorderServices?.(ids);
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
                    <Button size="compact" onClick={() => onEditService?.(svc.id)}>
                      Edit
                    </Button>
                    <Button size="compact" onClick={() => onRemoveService?.(svc.id)}>
                      Remove
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
          <div className={styles.settingsActions}>
            <Button size="compact" onClick={onAddService}>
              Add Service
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
