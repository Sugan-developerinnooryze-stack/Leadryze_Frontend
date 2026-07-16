import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/layout/Layout';

const LoginPage            = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage         = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage   = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage    = lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerifyEmailPage      = lazy(() => import('./pages/auth/VerifyEmailPage'));
const VerifyEmailSentPage  = lazy(() => import('./pages/auth/VerifyEmailSentPage'));
const AdminLoginPage       = lazy(() => import('./pages/auth/AdminLoginPage'));
const AdminDashboardPage   = lazy(() => import('./pages/admin/AdminDashboardPage'));

const DashboardPage   = lazy(() => import('./pages/dashboard/DashboardPage'));
const CustomersPage   = lazy(() => import('./pages/customers/CustomersPage'));
const CampaignsPage   = lazy(() => import('./pages/campaigns/CampaignsPage'));
const TemplatesPage   = lazy(() => import('./pages/templates/TemplatesPage'));
const AnalyticsPage   = lazy(() => import('./pages/analytics/AnalyticsPage'));
const SettingsPage    = lazy(() => import('./pages/settings/SettingsPage'));
const ConnectorsPage  = lazy(() => import('./pages/connectors/ConnectorsPage'));
const KnowledgePage   = lazy(() => import('./pages/knowledge/KnowledgePage'));
const CRMDataPage     = lazy(() => import('./pages/crm/CRMDataPage'));
const LogsPage        = lazy(() => import('./pages/logs/LogsPage'));
const BotHubPage      = lazy(() => import('./pages/bot/BotHubPage'));
const MyCalendarPage  = lazy(() => import('./pages/my-crm/MyCalendarPage'));
const MyCRMModulePage = lazy(() => import('./pages/my-crm/MyCRMModulePage'));
const ManagementPage  = lazy(() => import('./pages/my-crm/ManagementPage'));
const AutomationPage  = lazy(() => import('./pages/my-crm/AutomationPage'));
const NativeCRMPage      = lazy(() => import('./pages/native-crm/NativeCRMPage'));
const CategoriesPage     = lazy(() => import('./pages/native-crm/categories/CategoriesPage'));
const FsServicesPage     = lazy(() => import('./pages/native-crm/services/ServicesPage'));
const TeamsPage          = lazy(() => import('./pages/native-crm/teams/TeamsPage'));
const TeamViewPage       = lazy(() => import('./pages/native-crm/teams/TeamViewPage'));
const StaffsPage         = lazy(() => import('./pages/native-crm/staffs/StaffsPage'));
const StaffViewPage      = lazy(() => import('./pages/native-crm/staffs/StaffViewPage'));
const FsCustomersPage    = lazy(() => import('./pages/native-crm/customers/CustomersPage'));
const CustomerViewPage   = lazy(() => import('./pages/native-crm/customers/CustomerViewPage'));
const SitesPage          = lazy(() => import('./pages/native-crm/sites/SitesPage'));
const PartsPage          = lazy(() => import('./pages/native-crm/parts/PartsPage'));
const QuotationsPage     = lazy(() => import('./pages/native-crm/quotations/QuotationsPage'));
const QuotationPrintPage = lazy(() => import('./pages/native-crm/quotations/QuotationPrintPage'));
const WorkordersPage     = lazy(() => import('./pages/native-crm/workorders/WorkordersPage'));
const WorkorderPrintPage = lazy(() => import('./pages/native-crm/workorders/WorkorderPrintPage'));
const ContractsPage      = lazy(() => import('./pages/native-crm/contracts/ContractsPage'));
const ContractPrintPage  = lazy(() => import('./pages/native-crm/contracts/ContractPrintPage'));
const InvoicesPage       = lazy(() => import('./pages/native-crm/invoices/InvoicesPage'));
const InvoicePrintPage   = lazy(() => import('./pages/native-crm/invoices/InvoicePrintPage'));
const ReceiptsPage       = lazy(() => import('./pages/native-crm/receipts/ReceiptsPage'));
const ExpensesPage       = lazy(() => import('./pages/native-crm/expenses/ExpensesPage'));
const ActivitiesPage     = lazy(() => import('./pages/native-crm/activities/ActivitiesPage'));
const CalendarPage       = lazy(() => import('./pages/native-crm/calendar/CalendarPage'));
const ProductsPage          = lazy(() => import('./pages/native-crm/products/ProductsPage'));
const AssetsPage            = lazy(() => import('./pages/native-crm/assets/AssetsPage'));
const VehiclesPage          = lazy(() => import('./pages/native-crm/vehicles/VehiclesPage'));
const FSSettingsPage          = lazy(() => import('./pages/native-crm/settings/FSSettingsPage'));
const NativeLogsPage          = lazy(() => import('./pages/native-crm/native-logs/NativeLogsPage'));
const BranchesPage            = lazy(() => import('./pages/native-crm/branches/BranchesPage'));
const CustomFieldsAdminPage   = lazy(() => import('./pages/native-crm/custom-fields/CustomFieldsAdminPage'));
const FormTemplatesPage       = lazy(() => import('./pages/native-crm/custom-fields/FormTemplatesPage'));
const TemplateDesignerPage    = lazy(() => import('./pages/native-crm/template-designer/TemplateDesignerPage'));
const LeadsPage               = lazy(() => import('./pages/native-crm/leads/LeadsPage'));
const NativeCRMDealsPage      = lazy(() => import('./pages/native-crm/deals/DealsPage'));
const QuotationViewPage       = lazy(() => import('./pages/native-crm/quotations/QuotationViewPage'));
const WorkorderViewPage       = lazy(() => import('./pages/native-crm/workorders/WorkorderViewPage'));
const ContractViewPage        = lazy(() => import('./pages/native-crm/contracts/ContractViewPage'));
const InvoiceViewPage         = lazy(() => import('./pages/native-crm/invoices/InvoiceViewPage'));
const WorkflowBuilderPage     = lazy(() => import('./pages/native-crm/workflow/WorkflowBuilderPage'));
const CustomModuleBuilderPage = lazy(() => import('./pages/native-crm/custom-modules/CustomModuleBuilderPage'));
const CustomModulePage        = lazy(() => import('./pages/native-crm/custom-modules/CustomModulePage'));
const CustomerPortalPage      = lazy(() => import('./pages/portal/CustomerPortalPage'));
const ContactsPage    = lazy(() => import('./modules/crm/contacts/pages/ContactsPage'));
const CompaniesPage   = lazy(() => import('./modules/crm/companies/pages/CompaniesPage'));
const DealsPage       = lazy(() => import('./modules/crm/deals/pages/DealsPage'));
const TasksPage       = lazy(() => import('./modules/crm/tasks/pages/TasksPage'));
const TicketsPage     = lazy(() => import('./modules/crm/tickets/pages/TicketsPage'));
const CallsPage       = lazy(() => import('./modules/crm/calls/pages/CallsPage'));
const MeetingsPage    = lazy(() => import('./modules/crm/meetings/pages/MeetingsPage'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === 'SUPER_ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/admin/login" replace />;
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
}

const S = (C: React.LazyExoticComponent<() => JSX.Element | null>) => (
  <Suspense fallback={<PageLoader />}><C /></Suspense>
);

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login"              element={S(LoginPage)} />
        <Route path="/register"           element={S(RegisterPage)} />
        <Route path="/forgot-password"    element={S(ForgotPasswordPage)} />
        <Route path="/reset-password"     element={S(ResetPasswordPage)} />
        <Route path="/verify-email"       element={S(VerifyEmailPage)} />
        <Route path="/verify-email-sent"  element={S(VerifyEmailSentPage)} />

        {/* Super admin routes */}
        <Route path="/admin/login"        element={S(AdminLoginPage)} />
        <Route path="/admin/dashboard"    element={<RequireAdmin>{S(AdminDashboardPage)}</RequireAdmin>} />
        <Route path="/admin"              element={<Navigate to="/admin/dashboard" replace />} />

        {/* Client app routes */}
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index                    element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"         element={S(DashboardPage)} />
          <Route path="customers"         element={S(CustomersPage)} />
          <Route path="campaigns"         element={S(CampaignsPage)} />
          <Route path="templates"         element={S(TemplatesPage)} />
          <Route path="analytics"         element={S(AnalyticsPage)} />
          <Route path="connectors"        element={S(ConnectorsPage)} />
          <Route path="knowledge"         element={S(KnowledgePage)} />
          <Route path="settings"          element={S(SettingsPage)} />
          <Route path="crm/:channel/:module" element={S(CRMDataPage)} />
          <Route path="logs"              element={S(LogsPage)} />
          <Route path="bot-hub"              element={S(BotHubPage)} />
          <Route path="my-crm"               element={S(MyCalendarPage)} />
          <Route path="my-crm/management"   element={S(ManagementPage)} />
          <Route path="my-crm/automation"   element={S(AutomationPage)} />
          <Route path="my-crm/:channel/:module" element={S(MyCRMModulePage)} />
          <Route path="native-crm/categories" element={S(CategoriesPage)} />
          <Route path="native-crm/services"   element={S(FsServicesPage)} />
          <Route path="native-crm/teams"      element={S(TeamsPage)} />
          <Route path="native-crm/teams/:id"  element={S(TeamViewPage)} />
          <Route path="native-crm/staffs"     element={S(StaffsPage)} />
          <Route path="native-crm/staffs/:id" element={S(StaffViewPage)} />
          <Route path="native-crm/customers"  element={S(FsCustomersPage)} />
          <Route path="native-crm/customers/:id" element={S(CustomerViewPage)} />
          <Route path="native-crm/sites"      element={S(SitesPage)} />
          <Route path="native-crm/parts"      element={S(PartsPage)} />
          <Route path="native-crm/quotations"           element={S(QuotationsPage)} />
          <Route path="native-crm/quotations/:id"       element={S(QuotationViewPage)} />
          <Route path="native-crm/quotations/:id/print" element={S(QuotationPrintPage)} />
          <Route path="native-crm/workorders"           element={S(WorkordersPage)} />
          <Route path="native-crm/workorders/:id"       element={S(WorkorderViewPage)} />
          <Route path="native-crm/workorders/:id/print" element={S(WorkorderPrintPage)} />
          <Route path="native-crm/contracts"            element={S(ContractsPage)} />
          <Route path="native-crm/contracts/:id"        element={S(ContractViewPage)} />
          <Route path="native-crm/contracts/:id/print"  element={S(ContractPrintPage)} />
          <Route path="native-crm/invoices"             element={S(InvoicesPage)} />
          <Route path="native-crm/invoices/:id"         element={S(InvoiceViewPage)} />
          <Route path="native-crm/invoices/:id/print"   element={S(InvoicePrintPage)} />
          <Route path="native-crm/receipts"             element={S(ReceiptsPage)} />
          <Route path="native-crm/expenses"             element={S(ExpensesPage)} />
          <Route path="native-crm/activities"           element={S(ActivitiesPage)} />
          <Route path="native-crm/calendar"             element={S(CalendarPage)} />
          <Route path="native-crm/products"             element={S(ProductsPage)} />
          <Route path="native-crm/assets"               element={S(AssetsPage)} />
          <Route path="native-crm/vehicles"             element={S(VehiclesPage)} />
          <Route path="native-crm/settings"             element={S(FSSettingsPage)} />
          <Route path="native-crm/native-logs"         element={S(NativeLogsPage)} />
          <Route path="native-crm/branches"            element={S(BranchesPage)} />
          <Route path="native-crm/custom-fields"                   element={S(CustomFieldsAdminPage)} />
          <Route path="native-crm/custom-fields/form-templates"   element={S(FormTemplatesPage)} />
          <Route path="native-crm/template-designer"    element={S(TemplateDesignerPage)} />
          <Route path="native-crm/leads"              element={S(LeadsPage)} />
          <Route path="native-crm/deals"              element={S(NativeCRMDealsPage)} />
          <Route path="native-crm/workflow-builder"   element={S(WorkflowBuilderPage)} />
          <Route path="native-crm/custom-modules"     element={S(CustomModuleBuilderPage)} />
          <Route path="native-crm/custom/:slug"       element={S(CustomModulePage)} />
          <Route path="native-crm/:module"    element={S(NativeCRMPage)} />
          <Route path="crm/contacts"           element={S(ContactsPage)} />
          <Route path="crm/companies"          element={S(CompaniesPage)} />
          <Route path="crm/deals"              element={S(DealsPage)} />
          <Route path="crm/tasks"              element={S(TasksPage)} />
          <Route path="crm/tickets"            element={S(TicketsPage)} />
          <Route path="crm/calls"              element={S(CallsPage)} />
          <Route path="crm/meetings"           element={S(MeetingsPage)} />
        </Route>

        {/* Public customer portal — no auth required */}
        <Route path="/portal/:token" element={S(CustomerPortalPage)} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
