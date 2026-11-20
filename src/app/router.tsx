import { Outlet, Route, Routes } from 'react-router';
import { PlatformAdminGuard } from './route-guards/PlatformAdminGuard';
import { StoreMemberGuard } from './route-guards/StoreMemberGuard';
import { PlatformLayout } from '../components/layout/PlatformLayout';
import { StoreAdminLayout } from '../components/layout/StoreAdminLayout';
import { LandingPage } from '../pages/LandingPage';
import { PlatformLoginPage } from '../pages/PlatformLoginPage';
import { PlatformDashboardPage } from '../pages/PlatformDashboardPage';
import { PlatformStoresPage } from '../pages/PlatformStoresPage';
import { PlatformNewStorePage } from '../pages/PlatformNewStorePage';
import { PlatformStoreDetailPage } from '../pages/PlatformStoreDetailPage';
import { PlatformPlansPage } from '../pages/PlatformPlansPage';
import { PlatformAdminsPage } from '../pages/PlatformAdminsPage';
import { StoreLoginPage } from '../pages/StoreLoginPage';
import { SetPasswordPage } from '../pages/SetPasswordPage';
import { StoreDashboardPage } from '../pages/StoreDashboardPage';
import { ProductsPage } from '../pages/ProductsPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { PromotionsPage } from '../pages/PromotionsPage';
import { StoreAppearancePage } from '../pages/StoreAppearancePage';
import { StoreAccessPage } from '../pages/StoreAccessPage';
import { StoreAccountPage } from '../pages/StoreAccountPage';
import { PublicMenuPage } from '../pages/PublicMenuPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<StoreLoginPage />} />
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route path="/auth/set-password" element={<SetPasswordPage />} />
      <Route path="/m/:slug" element={<PublicMenuPage />} />

      <Route
        path="/platform"
        element={
          <PlatformAdminGuard>
            <PlatformLayout>
              <Outlet />
            </PlatformLayout>
          </PlatformAdminGuard>
        }
      >
        <Route index element={<PlatformDashboardPage />} />
        <Route path="stores" element={<PlatformStoresPage />} />
        <Route path="stores/new" element={<PlatformNewStorePage />} />
        <Route path="stores/:storeId" element={<PlatformStoreDetailPage />} />
        <Route path="plans" element={<PlatformPlansPage />} />
        <Route
          path="admins"
          element={
            <PlatformAdminGuard requireSuperAdmin>
              <PlatformAdminsPage />
            </PlatformAdminGuard>
          }
        />
      </Route>

      <Route
        path="/app"
        element={
          <StoreMemberGuard>
            <StoreAdminLayout>
              <Outlet />
            </StoreAdminLayout>
          </StoreMemberGuard>
        }
      >
        <Route index element={<StoreDashboardPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="promocoes" element={<PromotionsPage />} />
        <Route path="aparencia" element={<StoreAppearancePage />} />
        <Route path="acesso" element={<StoreAccessPage />} />
        <Route path="conta" element={<StoreAccountPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
