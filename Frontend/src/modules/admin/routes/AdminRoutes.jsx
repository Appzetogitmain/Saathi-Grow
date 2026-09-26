import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from '../context/AdminAuthContext';
import AdminLogin from '../pages/auth/AdminLogin';
import AdminLayout from '../AdminLayout';
import Dashboard from '../pages/Dashboard';
import AllOrders from '../pages/orders/AllOrders';
import OnlineOrders from '../pages/orders/OnlineOrders';
import POSHistory from '../pages/orders/POSHistory';
import AdminPOSBillingPage from '../pages/orders/AdminPOSBillingPage';
import ReturnRequests from '../pages/orders/ReturnRequests';
import AllProducts from '../pages/products/AllProducts';
import ProductDetails from '../pages/products/ProductDetails';
import AddProduct from '../pages/products/AddProduct';
import ProductInventoryLogs from '../pages/products/ProductInventoryLogs';
import AllCategories from '../pages/categories/AllCategories';
import AddCategory from '../pages/categories/AddCategory';
import AllSubCategories from '../pages/categories/AllSubCategories';
import AddSubCategory from '../pages/categories/AddSubCategory';
import AllCategoryPages from '../pages/categories/AllCategoryPages';
import ManageCategoryPage from '../pages/categories/ManageCategoryPage';
import AllBrands from '../pages/brands/AllBrands';
import AddBrand from '../pages/brands/AddBrand';
import AllCustomers from '../pages/customers/AllCustomers';
import CustomerOrders from '../pages/customers/CustomerOrders';
import StockOverview from '../pages/stock/StockOverview';
import BranchStock from '../pages/stock/BranchStock';
import StockAdjustments from '../pages/stock/StockAdjustments';
import AddStockAdjustment from '../pages/stock/AddStockAdjustment';
import LowStockAlerts from '../pages/stock/LowStockAlerts';
import InventoryRequests from '../pages/stock/InventoryRequests';
import DeliveryPartners from '../pages/delivery/DeliveryPartners';
import AddDeliveryPartner from '../pages/delivery/AddDeliveryPartner';
import AssignDeliveries from '../pages/delivery/AssignDeliveries';
import DeliveryTracking from '../pages/delivery/DeliveryTracking';
import PartnerDetails from '../pages/delivery/PartnerDetails';
import DeliverySlots from '../pages/delivery/DeliverySlots';
import CashSettlement from '../pages/delivery/CashSettlement';
import AllVendors from '../pages/vendors/AllVendors';
import AddVendor from '../pages/vendors/AddVendor';
import VendorProducts from '../pages/vendors/VendorProducts';
import VendorDetails from '../pages/vendors/VendorDetails';
import VendorPayouts from '../pages/vendors/VendorPayouts';
import PayoutDetails from '../pages/vendors/PayoutDetails';
import Branches from '../pages/locations/Branches';
import AddBranch from '../pages/locations/AddBranch';
import EditBranch from '../pages/locations/EditBranch';
import LocationManagement from '../pages/locations/LocationManagement';

import AllPromoCodes from '../pages/promocodes/AllPromoCodes';
import CreatePromoCode from '../pages/promocodes/CreatePromoCode';
import PushNotifications from '../pages/notifications/PushNotifications';
import AdminNotifications from '../pages/notifications/AdminNotifications';
import SupportTickets from '../pages/support/Tickets';

import FAQs from '../pages/support/FAQs';
import SalesReports from '../pages/reports/SalesReports';
import InventoryReports from '../pages/reports/InventoryReports';
import VendorReports from '../pages/reports/VendorReports';
import AdminVyaparReport from '../pages/reports/AdminVyaparReport';
import SearchAnalytics from '../pages/reports/SearchAnalytics';
import RevenueAnalytics from '../pages/analytics/RevenueAnalytics';

import VendorEarnings from '../pages/analytics/VendorEarnings';
import VendorEarningDetail from '../pages/analytics/VendorEarningDetail';
import DemandAnalytics from '../pages/analytics/DemandAnalytics';

import LegalManagement from '../pages/policies/LegalManagement';
import AdminProfile from '../pages/settings/AdminProfile';

import BillingSettings from '../pages/settings/BillingSettings';
import AppSettings from '../pages/settings/AppSettings';
import SocialProfile from '../pages/settings/SocialProfile';
import AllStaff from '../pages/staff/AllStaff';
import AddStaff from '../pages/staff/AddStaff';
import AllCampaigns from '../pages/campaigns/AllCampaigns';
import ManageCampaign from '../pages/campaigns/ManageCampaign';
import AllOfferDeals from '../pages/offers/AllOffers';
import ManageOfferDeal from '../pages/offers/ManageOffer';

const PlaceholderPage = ({ title }) => {
    const navigate = useNavigate();
    return (
        <div className="p-4 text-center d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
            <div className="mb-3 bg-light rounded-circle p-4">
                <span style={{ fontSize: '3rem' }}>🚧</span>
            </div>
            <h2 className="fw-bold text-dark">{title}</h2>
            <p className="text-muted lead mb-4">This module is currently under active development.</p>
            <div className="d-flex gap-2">
                <button 
                    className="btn btn-primary" 
                    onClick={() => navigate('/admin/dashboard')}
                >
                    Go to Dashboard
                </button>
                <button 
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/admin/support/tickets')}
                >
                    Contact Support
                </button>
            </div>
        </div>
    );
};

const ProtectedAdminRoute = () => {
    const { adminUser } = useAdminAuth();
    
    if (!adminUser) {
        return <Navigate to="/admin/login" replace />;
    }
    
    if (adminUser.role !== 'Admin') {
        return <Navigate to="/admin/login" replace />;
    }
    
    return <Outlet />;
};

import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';

const PublicAdminRoute = () => {
    const { adminUser } = useAdminAuth();
    if (adminUser) {
        // Only redirect to dashboard if they are actually an Admin
        if (adminUser.role === 'Admin') {
            return <Navigate to="/admin/dashboard" replace />;
        }
    }
    return <Outlet />;
};

const AdminRoutes = () => {
    return (
        <AdminAuthProvider>
            <Routes>
                {/* Public Admin Routes */}
                <Route element={<PublicAdminRoute />}>
                    <Route path="login" element={<AdminLogin />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />
                    <Route path="reset-password/:token" element={<ResetPassword />} />
                </Route>

                {/* Protected Admin Routes */}
                <Route element={<ProtectedAdminRoute />}>
                    <Route element={<AdminLayout />}>
                        <Route path="/" element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />

                        {/* Orders */}
                        <Route path="orders" element={<AllOrders />} />
                        <Route path="orders/online" element={<OnlineOrders />} />
                        <Route path="orders/pos" element={<POSHistory />} />
                        <Route path="orders/pos-billing" element={<AdminPOSBillingPage />} />
                        <Route path="orders/returns" element={<ReturnRequests />} />

                        {/* Products */}
                        <Route path="products">
                            <Route index element={<AllProducts />} />
                            <Route path="add" element={<AddProduct />} />
                            <Route path="locations/management" element={<LocationManagement />} />
                            <Route path=":id" element={<ProductDetails />} />
                            <Route path=":id/inventory-logs" element={<ProductInventoryLogs />} />
                        </Route>

                        {/* Categories */}
                        <Route path="categories" element={<AllCategories />} />
                        <Route path="categories/add" element={<AddCategory />} />
                        <Route path="category-pages" element={<AllCategoryPages />} />
                        <Route path="category-pages/add" element={<ManageCategoryPage />} />
                        <Route path="category-pages/edit/:id" element={<ManageCategoryPage />} />
                        <Route path="subcategories" element={<AllSubCategories />} />
                        <Route path="subcategories/add" element={<AddSubCategory />} />

                        {/* Brands */}
                        <Route path="brands" element={<AllBrands />} />
                        <Route path="brands/add" element={<AddBrand />} />

                        {/* Customers */}
                        <Route path="customers" element={<AllCustomers />} />
                        <Route path="customers/orders" element={<CustomerOrders />} />

                        {/* Staff */}
                        <Route path="staff" element={<AllStaff />} />
                        <Route path="staff/add" element={<AddStaff />} />

                        {/* Stock Management */}
                        <Route path="stock" element={<StockOverview />} />
                        <Route path="stock/branches" element={<BranchStock />} />
                        <Route path="stock/adjustments" element={<StockAdjustments />} />
                        <Route path="stock/adjustments/add" element={<AddStockAdjustment />} />
                        <Route path="stock/alerts" element={<LowStockAlerts />} />
                        <Route path="stock/requests" element={<InventoryRequests />} />


                        {/* Delivery Management */}
                        <Route path="delivery/partners" element={<DeliveryPartners />} />
                        <Route path="delivery/partners/:id" element={<PartnerDetails />} />
                        <Route path="delivery/partners/add" element={<AddDeliveryPartner />} />
                        <Route path="delivery/assign" element={<AssignDeliveries />} />
                        <Route path="delivery/tracking" element={<DeliveryTracking />} />
                        <Route path="delivery/slots" element={<DeliverySlots />} />
                        <Route path="delivery/settlement" element={<CashSettlement />} />

                        {/* Vendors */}
                        <Route path="vendors" element={<AllVendors />} />
                        <Route path="vendors/:id" element={<VendorDetails />} />
                        <Route path="vendors/add" element={<AddVendor />} />
                        <Route path="vendors/products" element={<VendorProducts />} />
                        <Route path="vendors/payouts" element={<VendorPayouts />} />
                        <Route path="vendors/payouts/:id" element={<PayoutDetails />} />

                        {/* Locations */}
                        <Route path="locations/branches" element={<Branches />} />
                        <Route path="locations/branches/add" element={<AddBranch />} />
                        <Route path="locations/branches/edit/:id" element={<EditBranch />} />
                        

                        {/* Offers & Sliders */}
                        <Route path="offers/deals" element={<AllOfferDeals />} />
                        <Route path="offers/deals/add" element={<ManageOfferDeal />} />
                        <Route path="offers/deals/edit/:id" element={<ManageOfferDeal />} />
                        <Route path="campaigns" element={<AllCampaigns />} />
                        <Route path="campaigns/add" element={<ManageCampaign />} />
                        <Route path="campaigns/edit/:id" element={<ManageCampaign />} />

                        {/* Promo Codes */}
                        <Route path="promocodes" element={<AllPromoCodes />} />
                        <Route path="promocodes/create" element={<CreatePromoCode />} />

                        {/* Notifications */}
                        <Route path="notifications/push" element={<PushNotifications />} />
                        <Route path="notifications/inbox" element={<AdminNotifications />} />

                        {/* Support Desk */}
                        <Route path="support/tickets" element={<SupportTickets />} />

                        <Route path="support/faqs" element={<FAQs />} />

                        {/* Reports */}
                        <Route path="reports/sales" element={<SalesReports />} />
                        <Route path="reports/inventory" element={<InventoryReports />} />
                        <Route path="reports/vendors" element={<VendorReports />} />
                        <Route path="reports/vyapar" element={<AdminVyaparReport />} />
                        <Route path="reports/search-analytics" element={<SearchAnalytics />} />

                        {/* Analytics & Finance */}
                        <Route path="analytics/revenue" element={<RevenueAnalytics />} />

                        <Route path="analytics/earnings" element={<VendorEarnings />} />
                        <Route path="analytics/earnings/:id" element={<VendorEarningDetail />} />
                        <Route path="analytics/demand" element={<DemandAnalytics />} />


                        {/* Policies */}
                        <Route path="policies" element={<LegalManagement />} />

                        {/* Settings */}
                        <Route path="settings/profile" element={<AdminProfile />} />

                        <Route path="settings/billing" element={<BillingSettings />} />
                        <Route path="settings/app" element={<AppSettings />} />
                        <Route path="settings/social" element={<SocialProfile />} />

                        {/* Fallback for all other sub-routes defined in sidebar */}
                        <Route path="*" element={<PlaceholderPage title="Page Not Found / Under Construction" />} />
                    </Route>
                </Route>
            </Routes>
        </AdminAuthProvider>
    );
};

export default AdminRoutes;
