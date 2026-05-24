import { Select } from './Select';

type SortField = 'name' | 'size' | 'type' | 'modifiedAt';
type SortDirection = 'asc' | 'desc';

type SortSelectProps = {
  view: 'files' | 'trash';
  sortField: SortField;
  sortDirection: SortDirection;
  onChange: (value: string) => void;
  className?: string;
};

const modifiedAtLabels: Record<'files' | 'trash', { desc: string; asc: string }> = {
  files: { desc: 'Newest first', asc: 'Oldest first' },
  trash: { desc: 'Deleted newest first', asc: 'Deleted oldest first' },
};

export function SortSelect({ view, sortField, sortDirection, onChange, className }: SortSelectProps) {
  const labels = modifiedAtLabels[view];
  return (
    <Select
      className={className}
      value={`${sortField}:${sortDirection}`}
      onChange={onChange}
      ariaLabel={`Sort ${view}`}
    >
      <option value="name:asc">Name A-Z</option>
      <option value="name:desc">Name Z-A</option>
      <option value="size:asc">Size small first</option>
      <option value="size:desc">Size large first</option>
      <option value="type:asc">Type A-Z</option>
      <option value="type:desc">Type Z-A</option>
      <option value="modifiedAt:desc">{labels.desc}</option>
      <option value="modifiedAt:asc">{labels.asc}</option>
    </Select>
  );
}
