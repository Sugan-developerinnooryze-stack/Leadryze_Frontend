import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Branch {
  _id:         string;
  tenantId:    string;
  branchCode:  string;
  branchName:  string;
  branchType:  'headquarters' | 'branch' | 'warehouse';
  email?:      string;
  phone?:      string;
  gstin?:      string;
  pan?:        string;
  address1?:   string;
  address2?:   string;
  city?:       string;
  state?:      string;
  country?:    string;
  postalCode?: string;
  companyLogo?:  string;
  bankName?:     string;
  accountName?:  string;
  accountNumber?: string;
  ifscCode?:     string;
  upiId?:        string;
  currency?:     string;
  timezone?:     string;
  managerId?:    string;
  maxUsers?:     number;
  status:      'active' | 'inactive';
}

interface BranchState {
  branches:      Branch[];
  currentBranch: Branch | null;
  setBranch:     (branch: Branch | null) => void;
  setBranches:   (branches: Branch[]) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branches:      [],
      currentBranch: null,
      setBranch:  (branch) => set({ currentBranch: branch }),
      setBranches: (branches) => set({ branches }),
    }),
    { name: 'leadryze-branch-store' }
  )
);
