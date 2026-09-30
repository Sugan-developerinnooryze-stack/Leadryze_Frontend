import { useBranchStore } from '../../stores/branch.store';

export function CompanyBadge({ branchId }: { branchId?: string | null }) {
  const branches = useBranchStore(s => s.branches);

  if (!branchId) {
    return <span className="text-xs text-text-muted font-medium">Default</span>;
  }

  const branch = branches.find(b => b._id === branchId);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-ryze-600/10 text-ryze-700 dark:text-ryze-400 border border-ryze-600/20 truncate max-w-[120px]">
      {branch?.branchName ?? 'Branch'}
    </span>
  );
}
