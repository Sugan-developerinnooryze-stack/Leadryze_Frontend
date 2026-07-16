import { useBranchStore } from '../../stores/branch.store';

export function CompanyBadge({ branchId }: { branchId?: string | null }) {
  const branches = useBranchStore(s => s.branches);

  if (!branchId) {
    return <span className="text-xs text-gray-400 font-medium">Default</span>;
  }

  const branch = branches.find(b => b._id === branchId);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[120px]">
      {branch?.branchName ?? 'Branch'}
    </span>
  );
}
