import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ServicesPage } from "@/features/dashboard/ServicesPage";
import { Bai2UploadPage } from "@/features/services/Bai2UploadPage";
import { TranslationUploadPage } from "@/features/services/TranslationUploadPage";
import { DataExtractionUploadPage } from "@/features/services/DataExtractionUploadPage";
import { OcrUploadPage } from "@/features/services/OcrUploadPage";
import { FreeServicesPage } from "@/features/services/FreeServicesPage";
import { PlansPage } from "@/features/plans/PlansPage";
import { PaymentsPage } from "@/features/payments/PaymentsPage";
import { SupportPage } from "@/features/support/SupportPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { ApiDocumentationPage } from "@/features/profile/ApiDocumentationPage";
import { AdminPage } from "@/features/admin/AdminPage";
import { AdminOverviewPage } from "@/features/admin/AdminOverviewPage";
import { CompanySettingsPage } from "@/features/admin/CompanySettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/free" element={<FreeServicesPage />} />
          <Route path="/services/bai2" element={<Bai2UploadPage />} />
          <Route path="/services/translation" element={<TranslationUploadPage />} />
          <Route path="/services/data-extraction" element={<DataExtractionUploadPage />} />
          <Route path="/services/ocr" element={<OcrUploadPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/api-documentation" element={<ApiDocumentationPage />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/overview" element={<AdminOverviewPage />} />
            <Route path="/admin/company" element={<CompanySettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
