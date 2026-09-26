import { emptyTissue } from '../../lib/rules';
import { RowTable } from './RowTable';

/** Discard Form tissue list: repeatable rows with an X box each. */
export function TissueTable() {
  return (
    <RowTable
      arrayKey="tissues"
      nameKey="description"
      newRow={emptyTissue}
      columns={[
        { key: 'graftId', label: 'Graft ID' },
        { key: 'description', label: 'Tissue Description' },
        { key: 'storageLocation', label: 'Storage Location' },
        { key: 'xMarked', label: 'X', kind: 'checkbox' },
      ]}
    />
  );
}
