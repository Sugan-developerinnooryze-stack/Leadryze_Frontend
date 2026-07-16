import { useQueryClient } from '@tanstack/react-query';
import { Branch, useBranchStore } from '../../stores/branch.store';
import { useBranchesQuery } from '../../modules/native-crm/queries/branch.queries';

export function CompanyFilterBar() {
  const qc = useQueryClient();
  const { branches, currentBranch, setBranch } = useBranchStore();
  useBranchesQuery(false);

  const activeBranches = branches.filter((b) => b.status === 'active');
  if (activeBranches.length === 0) return null;

  function switchBranch(branch: Branch | null) {
    setBranch(branch);
    qc.invalidateQueries({ queryKey: ['native-crm'] });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-3">
      <span className="text-xs text-gray-400 font-medium mr-1 shrink-0">Company:</span>
      <button
        onClick={() => switchBranch(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
          !currentBranch
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
        }`}
      >
        All Companies
      </button>
      {activeBranches.map((b) => (
        <button
          key={b._id}
          onClick={() => switchBranch(b)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
            currentBranch?._id === b._id
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          {b.branchName}
        </button>
      ))}
    </div>
  );
}
