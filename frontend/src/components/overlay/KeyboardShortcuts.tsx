import { Overlay } from '../ui/shared';
import styles from './KeyboardShortcuts.module.css';

type KeyboardShortcutsProps = {
  onClose: () => void;
};

const shortcuts: [string, string][] = [
  ['Navigate into folder / Open file', 'Enter'],
  ['Deselect all', 'Esc'],
  ['Select all', '⌘A'],
  ['Copy selected items', '⌘C'],
  ['Cut selected items', '⌘X'],
  ['Paste clipboard items', '⌘V'],
  ['Invert selection', '⌘I'],
  ['Global search', '⌘K'],
  ['Toggle shortcuts', '?'],
  ['Rename selected item', 'F2'],
  ['Move selected items to trash', 'Delete'],
  ['Shift-range select', '⇧+click'],
  ['Multi-select toggle', '⌘+click'],
  ['Close preview / Clear search', 'Esc'],
  ['Context menu', 'Right click'],
];

export function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps) {
  return (
    <Overlay onClose={onClose}>
      <div className={styles.shortcutsPanel}>
        <h3>Keyboard Shortcuts</h3>
        {shortcuts.map(([label, key], index) => (
          index === shortcuts.length - 2 ? (
            <>
              <hr key="hr" />
              <div className={styles.shortcutRow} key={index}>
                <span>{label}</span>
                <span className={styles.shortcutKey}>{key}</span>
              </div>
            </>
          ) : (
            <div className={styles.shortcutRow} key={index}>
              <span>{label}</span>
              <span className={styles.shortcutKey}>{key}</span>
            </div>
          )
        ))}
      </div>
    </Overlay>
  );
}
