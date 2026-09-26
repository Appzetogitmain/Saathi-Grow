export const adminSidebarMenu = [
    {
        title: 'Dashboard',
        key: 'dashboard',
        path: '/admin/dashboard',
        icon: 'LayoutDashboard',
        permission: null
    },
    {
        title: 'Orders',
        key: 'orders',
        icon: 'ShoppingCart',
        permission: 'VIEW_ORDERS',
        submenu: [
            { title: 'All Orders', key: 'all_orders', path: '/admin/orders' },
            { title: 'POS Billing', key: 'pos_billing', path: '/admin/orders/pos-billing' },
            { title: 'POS History', key: 'pos_history', path: '/admin/orders/pos' },
            { title: 'Online Orders', key: 'online_orders', path: '/admin/orders/online' },
            { title: 'Return Requests', key: 'return_requests', path: '/admin/orders/returns' },
        ],
    },
    {
        title: 'Products',
        key: 'products',
        icon: 'Package',
        permission: 'VIEW_PRODUCTS',
        submenu: [
            { title: 'All Products', key: 'all_products', path: '/admin/products' },
            { title: 'Add Product', key: 'add_product', path: '/admin/products/add' },
            { title: 'Physical Locations', key: 'physical_locations', path: '/admin/products/locations/management' },
        ],
    },
    {
        title: 'Categories & Brands',
        key: 'categories_brands',
        icon: 'Tag',
        permission: null,
        submenu: [
            { title: 'All Categories', key: 'all_categories', path: '/admin/categories' },
            { title: 'Add Category', key: 'add_category', path: '/admin/categories/add' },
            { title: 'Category Pages', key: 'category_pages', path: '/admin/category-pages' },
            { title: 'All Subcategories', key: 'all_subcategories', path: '/admin/subcategories' },
            { title: 'Add Subcategory', key: 'add_subcategory', path: '/admin/subcategories/add' },
            { title: 'All Brands', key: 'all_brands', path: '/admin/brands' },
            { title: 'Add Brand', key: 'add_brand', path: '/admin/brands/add' },
        ],
    },
    {
        title: 'Customers',
        key: 'customers',
        icon: 'Users',
        permission: 'VIEW_CUSTOMERS',
        submenu: [
            { title: 'All Customers', key: 'all_customers', path: '/admin/customers' },
            { title: 'Customer Orders', key: 'customer_orders', path: '/admin/customers/orders' },
        ],
    },
    {
        title: 'Staff Management',
        key: 'staff_management',
        icon: 'Briefcase',
        permission: null,
        submenu: [
            { title: 'All Staff', key: 'all_staff', path: '/admin/staff' },
            { title: 'Add Staff', key: 'add_staff', path: '/admin/staff/add' },
        ],
    },
    {
        title: 'Stock Management',
        key: 'stock_management',
        icon: 'Boxes',
        permission: 'MANAGE_INVENTORY',
        submenu: [
            { title: 'Stock Overview', key: 'stock_overview', path: '/admin/stock' },
            { title: 'Branch-wise Stock', key: 'branch_wise_stock', path: '/admin/stock/branches' },
            { title: 'Stock Adjustments', key: 'stock_adjustments', path: '/admin/stock/adjustments' },
            { title: 'Low Stock Alerts', key: 'low_stock_alerts', path: '/admin/stock/alerts' },
            { title: 'Inventory Requests', key: 'inventory_requests', path: '/admin/stock/requests' },
        ],
    },
    {
        title: 'Delivery Management',
        key: 'delivery_management',
        icon: 'Truck',
        permission: null,
        submenu: [
            { title: 'Delivery Partners', key: 'delivery_partners', path: '/admin/delivery/partners' },
            { title: 'Assign Deliveries', key: 'assign_deliveries', path: '/admin/delivery/assign' },
            { title: 'Delivery Tracking', key: 'delivery_tracking', path: '/admin/delivery/tracking' },
            { title: 'Delivery Slots', key: 'delivery_slots', path: '/admin/delivery/slots' },
            { title: 'Cash Settlement', key: 'cash_settlement', path: '/admin/delivery/settlement' },
        ],
    },
    {
        title: 'Vendors',
        key: 'vendors',
        icon: 'Store',
        permission: null,
        submenu: [
            { title: 'All Vendors', key: 'all_vendors', path: '/admin/vendors' },
            { title: 'Add Vendor', key: 'add_vendor', path: '/admin/vendors/add' },
            { title: 'Vendor Products', key: 'vendor_products', path: '/admin/vendors/products' },
            { title: 'Vendor Payouts', key: 'vendor_payouts', path: '/admin/vendors/payouts' },
        ],
    },
    {
        title: 'Branches',
        key: 'branches',
        icon: 'MapPin',
        permission: null,
        submenu: [
            { title: 'Branches', key: 'branches', path: '/admin/locations/branches' },
            { title: 'Add Branch', key: 'add_branch', path: '/admin/locations/branches/add' },
        ],
    },
    {
        title: 'Banners',
        key: 'offers_sliders',
        icon: 'Image',
        permission: null,
        submenu: [
            { title: 'Banner Deals', key: 'banner_deals', path: '/admin/offers/deals' },
            { title: 'Festive Campaigns', key: 'festive_campaigns', path: '/admin/campaigns' },
        ],
    },
    {
        title: 'Promo Codes',
        key: 'promo_codes',
        icon: 'Ticket',
        permission: null,
        submenu: [
            { title: 'All Promo Codes', key: 'all_promo_codes', path: '/admin/promocodes' },
            { title: 'Create Promo Code', key: 'create_promo_code', path: '/admin/promocodes/create' },
        ],
    },
    {
        title: 'Notifications',
        key: 'notifications',
        icon: 'Bell',
        permission: null,
        submenu: [
            { title: 'Push Notification', key: 'push_notification', path: '/admin/notifications/push' },
            { title: 'Admin Inbox', key: 'admin_inbox', path: '/admin/notifications/inbox' }
        ]
    },
    {
        title: 'Support Desk',
        key: 'support_desk',
        icon: 'Headphones',
        permission: 'VIEW_CUSTOMERS',
        submenu: [
            { title: 'Tickets', key: 'tickets', path: '/admin/support/tickets' },
            { title: 'FAQs', key: 'faqs', path: '/admin/support/faqs' },
        ],
    },
    {
        title: 'Reports',
        key: 'reports',
        icon: 'FileText',
        permission: null,
        submenu: [
            { title: 'Sales Reports', key: 'sales_reports', path: '/admin/reports/sales' },
            { title: 'Inventory Reports', key: 'inventory_reports', path: '/admin/reports/inventory' },
            { title: 'Vendor Reports', key: 'vendor_reports', path: '/admin/reports/vendors' },
            { title: 'Vyapar Report', key: 'vyapar_reports', path: '/admin/reports/vyapar' },
            { title: 'Search Analytics', key: 'search_analytics', path: '/admin/reports/search-analytics' },
        ],
    },
    {
        title: 'Analytics & Finance',
        key: 'analytics_finance',
        icon: 'BarChart3',
        permission: null,
        submenu: [
            { title: 'Revenue Analytics', key: 'revenue_analytics', path: '/admin/analytics/revenue' },
            { title: 'Demand Analytics', key: 'demand_analytics', path: '/admin/analytics/demand' },
            { title: 'Vendor Earnings', key: 'vendor_earnings', path: '/admin/analytics/earnings' },
        ],
    },
    {
        title: 'Legal & Policies',
        key: 'legal_policies',
        path: '/admin/policies',
        icon: 'Shield',
        permission: null
    },
    {
        title: 'Settings',
        key: 'settings',
        icon: 'Settings',
        permission: null,
        submenu: [
            { title: 'Admin Profile', key: 'admin_profile', path: '/admin/settings/profile' },
            { title: 'Tax & Billing Settings', key: 'tax_billing_settings', path: '/admin/settings/billing' },
            { title: 'App Settings', key: 'app_settings', path: '/admin/settings/app' },
            { title: 'Social Profile', key: 'social_profile', path: '/admin/settings/social' },
        ],
    },
];
