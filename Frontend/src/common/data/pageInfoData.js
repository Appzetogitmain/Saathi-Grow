/**
 * pageInfoData.js
 * Centralized info content for all admin page tooltips.
 * Each entry has: title, description, keyPoints[], workflow[]
 */

export const pageInfoData = {

    // ─── DASHBOARD ──────────────────────────────────────────
    dashboard: {
        title: 'Command Center',
        description: 'Get a real-time overview of your enterprise performance, active transactions, and operational health.',
        keyPoints: [
            'Monitor key performance indicators (Revenue, Orders, Growth)',
            'Track live transaction flow and processing status',
            'Visualize revenue trajectories with interactive charts',
            'Instant alerts for low stock and pending support tickets',
        ],
        workflow: [
            'Review the KPI cards for immediate performance snapshots.',
            'Analyze the sales chart to identify peak operational hours.',
            'Check "Recent Transactions" to monitor the live order stream.',
            'Use "Quick Actions" for fast navigation to management modules.',
        ],
    },

    // ─── ORDERS ──────────────────────────────────────────────
    allOrders: {
        title: 'Order Management',
        description: 'Track and process all customer orders across various channels including Online App and POS Billing.',
        keyPoints: [
            'Monitor real-time order lifecycle from Pending to Delivered',
            'Update order status and notify customers automatically',
            'Filter by payment method, slot timing, and order source',
            'Access detailed order history including itemized breakdowns',
        ],
        workflow: [
            'Use the search bar to find orders by ID or customer phone.',
            'Click the "Eye" icon to view the full order details, invoice, and tracking.',
            'Update statuses like "Preparing" or "Out for Delivery" to keep customers informed.',
            'Use advanced filters to identify delivery bottlenecks in specific slots.',
        ],
    },

    posOrders: {
        title: 'POS History',
        description: 'View all orders placed through the in-store Point-of-Sale (POS) billing system. These are walk-in customer purchases billed at the counter.',
        keyPoints: [
            'Review all historical walk-in and counter sales',
            'Filter by date, staff member, or branch',
            'Print or re-print receipts for any POS transaction',
            'Track cash vs. digital payment breakdown',
        ],
        workflow: [
            'Select a date range to pull historical POS billing records.',
            'Use branch filter to isolate transactions from a specific store.',
            'Click any record to see the itemized bill and payment mode.',
            'Use the print icon to re-generate a receipt if needed.',
        ],
    },

    onlineOrders: {
        title: 'Online Orders',
        description: 'Manage all orders placed through the SaathiGro mobile/web app by customers. These require picking, packing, and delivery fulfillment.',
        keyPoints: [
            'See all app-based orders in real-time',
            'Confirm, reject, or put orders on hold',
            'Assign delivery partners and track dispatch',
            'Handle refunds and escalations',
        ],
        workflow: [
            'New orders arrive with "Pending" status — review and confirm.',
            'Once confirmed, assign a delivery partner for dispatch.',
            'Track the order through "Dispatched" → "Out for Delivery" → "Delivered".',
            'For issues, use the support ticket link in the order detail.',
        ],
    },

    returnRequests: {
        title: 'Return Requests',
        description: 'Handle all customer-initiated return and refund requests. Review the reason, inspect the product, and approve or reject the return to trigger a refund.',
        keyPoints: [
            'View all pending, approved, and rejected return requests',
            'See customer-provided reason and photos for returns',
            'Approve returns to auto-trigger a refund to the customer',
            'Reject invalid return requests with a reason',
        ],
        workflow: [
            'Open a return request to review the customer\'s claim and evidence.',
            'Verify the original order details and policy eligibility.',
            'Click "Approve Return" to initiate a refund, or "Reject" with a reason.',
            'The customer is notified automatically of the decision.',
        ],
    },

    // ─── PRODUCTS ─────────────────────────────────────────────
    allProducts: {
        title: 'Product Catalog',
        description: 'Manage your entire product inventory, prices, and stock levels across all branches and vendor partners.',
        keyPoints: [
            'Monitor stock levels with "Low Stock" and "Out of Stock" alerts',
            'Track product performance and pricing across branches',
            'Generate and download QR codes for easy item scanning',
            'Manage dietary preferences (Veg/Non-Veg) and Saathigro priority labels',
        ],
        workflow: [
            'Use the search bar and category filters to find specific items.',
            'Click the "Plus" icon to restock items for a specific branch.',
            'Download QR codes for printing or digital use in-store.',
            'Use the "History" icon to audit stock adjustments over time.',
        ],
    },

    addProduct: {
        title: 'Add Product',
        description: 'Create a new product entry in the catalog. Fill in all details — name, category, pricing, images, nutritional info, and stock — to make it live in the app.',
        keyPoints: [
            'Set product name, SKU, category, brand, and tags',
            'Upload multiple images and set a primary display image',
            'Configure base price, MRP, and applicable taxes',
            'Set low-stock threshold for automatic alerts',
            'Add dietary classification and nutritional details',
        ],
        workflow: [
            'Fill in the basic information: name, category, and brand.',
            'Upload at least one high-quality product image.',
            'Set the MRP and selling price, then configure GST percentage.',
            'Set the initial stock quantity and low-stock alert threshold.',
            'Review all details and click "Save Product" to publish.',
        ],
    },

    inventoryLogs: {
        title: 'Product Inventory Logs',
        description: 'A detailed audit trail of every stock movement for a specific product. Track when stock was added, deducted, adjusted, or transferred across branches.',
        keyPoints: [
            'View a chronological log of all stock changes',
            'Filter by date range, branch, or action type',
            'Identify who made each stock adjustment (staff accountability)',
            'Detect discrepancies between expected and actual stock',
        ],
        workflow: [
            'Navigate here from a product\'s detail page or the Stock module.',
            'Filter by date range to narrow down the audit window.',
            'Review each log entry: date, quantity change, reason, and staff name.',
            'Flag any suspicious entries and cross-reference with sales data.',
        ],
    },

    // ─── CATEGORIES & BRANDS ──────────────────────────────────
    allCategories: {
        title: 'Category Management',
        description: 'Organize your catalog by creating and managing product categories with custom visual themes.',
        keyPoints: [
            'Create meaningful groupings for easier customer navigation',
            'Set custom background colors for app-side visual distinction',
            'Map categories to unique slugs for SEO and deep linking',
            'Control visibility with Active and Draft status toggles',
        ],
        workflow: [
            'Add a new category with a representative icon or image.',
            'Specify a background color that matches the category theme.',
            'Click the "Edit" icon to update sorting order or naming.',
            'Use the "Info" icon to view category descriptions provided during creation.',
        ],
    },

    addCategory: {
        title: 'Add Category',
        description: 'Create a new product category to organize your catalog and improve navigation in the customer app.',
        keyPoints: [
            'Set a unique category name and a browsable slug',
            'Upload a cover image or icon for display in the app',
            'Set parent category to create a hierarchy',
            'Choose the display order/position',
        ],
        workflow: [
            'Enter the category name (e.g., "Fresh Vegetables").',
            'Upload an icon or image that represents the category.',
            'Optionally assign it under a parent category if applicable.',
            'Set its display priority and click "Save Category".',
        ],
    },

    allBrands: {
        title: 'Brand Registry',
        description: 'Manage specialized brands and product labels available in your marketplace.',
        keyPoints: [
            'Organize products by their parent brands and manufacturers',
            'Maintain brand visual identity with logos and descriptions',
            'Link brands to specific categories for better filtering',
            'Enable or disable brands globally across the platform',
        ],
        workflow: [
            'Add new brand partners with their official logo and website.',
            'Assign brands to categories to improve product searchability.',
            'Use the "Edit" function to update brand descriptions or status.',
            'Monitor brand performance within the analytics module.',
        ],
    },

    addBrand: {
        title: 'Add Brand',
        description: 'Register a new product brand in the system so it can be assigned to products and appear in customer-facing brand filters.',
        keyPoints: [
            'Enter the official brand name',
            'Upload the brand\'s logo image',
            'Optionally add a brand description or website',
        ],
        workflow: [
            'Enter the brand name exactly as it should appear to customers.',
            'Upload a clean logo (preferably on white or transparent background).',
            'Click "Save Brand" to add it to the list.',
            'Go to any product and assign this brand from the dropdown.',
        ],
    },

    // ─── CUSTOMERS ─────────────────────────────────────────────
    allCustomers: {
        title: 'Customer Directory',
        description: 'Manage your customer base, track their purchasing behavior, and handle wallet balances.',
        keyPoints: [
            'View comprehensive customer profiles and order history',
            'Monitor and update customer wallet balances',
            'Send direct emails or messages for engagement',
            'Manage customer access status (Block/Unblock)',
        ],
        workflow: [
            'Search for customers by name, email, or unique ID.',
            'Click "View Profile" in the action menu to see their lifetime value and addresses.',
            'Use the communication tools to resolve issues or send promotions.',
            'Block accounts that violate platform policies or show suspicious behavior.',
        ],
    },

    customerOrders: {
        title: 'Customer Orders',
        description: 'View orders grouped by customer, making it easy to see order patterns, frequent buyers, and customers who need support.',
        keyPoints: [
            'Filter orders by specific customer for order history',
            'See repeat order patterns and preferences',
            'Identify high-value customers for loyalty tracking',
            'Quick-link to specific orders for support resolution',
        ],
        workflow: [
            'Search for a customer using name or phone in the top filter.',
            'The table will show all orders placed by that customer.',
            'Click any order to view its full detail and take action.',
        ],
    },

    // ─── STAFF MANAGEMENT ─────────────────────────────────────
    manageStaff: {
        title: 'Staff Management',
        description: 'Manage administrative staff members, assign roles, and configure granular access permissions for different system modules.',
        keyPoints: [
            'Add new staff members with specific roles (Admin/Staff)',
            'Assign staff to specific branches or keep them as global users',
            'Configure detailed permissions for orders, products, and more',
            'Monitor staff active status and manage account access',
        ],
        workflow: [
            'Click "Add Staff" to create a new user profile.',
            'Use the "Key" icon on any staff row to manage their unique permissions.',
            'Edit profile details like email or branch assignment using the "Edit" button.',
            'Deactivate accounts for staff members who are no longer with the organization.',
        ],
    },

    allStaff: {
        title: 'All Staff (Legacy View)',
        description: 'Classic view of all admin staff accounts. Use for quick status checks and role assignment.',
        keyPoints: [
            'View all staff with their roles and branches',
            'Quick-edit permissions and module-level access',
            'Activate or deactivate staff accounts instantly',
        ],
        workflow: [
            'Browse the staff list for status overviews.',
            'Click "Edit" to modify roles or individual modules.',
            'Use "Add Staff" for new onboarding.',
        ],
    },

    addStaff: {
        title: 'Add Staff Member',
        description: 'Create a new staff account and assign them a role and set of permissions that control what they can see and do inside the admin panel.',
        keyPoints: [
            'Set the staff member\'s name, email, and contact',
            'Assign a role: Store Manager or Sub-Admin',
            'Select specific module permissions (e.g., VIEW_ORDERS, MANAGE_INVENTORY)',
            'Assign them to a specific branch if applicable',
        ],
        workflow: [
            'Enter the staff member\'s full name and contact details.',
            'Set their initial password (they should change it on first login).',
            'Choose their role and assign the appropriate permissions.',
            'Click "Create Staff Account" to grant them access.',
        ],
    },

    // ─── STOCK MANAGEMENT ─────────────────────────────────────
    stockOverview: {
        title: 'Inventory Intelligence',
        description: 'Comprehensive oversight of stock density, health scores, and procurement needs.',
        keyPoints: [
            'Analyze network-wide inventory worth and total units',
            'Identify "Regional Health" hotspots for stock redistribution',
            'Review critical "Urgent Restock" lists across all hubs',
            'Visualize stock distribution by product category',
        ],
        workflow: [
            'Select a specific branch to filter the intelligence data.',
            'Check "Health Scores" to identify locations needing attention.',
            'Use the "Urgent Restock" list to trigger fast procurement.',
            'Analyze "Stock Density" to plan future inventory movements.',
        ],
    },

    branchStock: {
        title: 'Branch-wise Stock',
        description: 'View and compare stock levels broken down by individual branch. Essential for managing multi-location inventory and inter-branch transfers.',
        keyPoints: [
            'Compare stock across branches side by side',
            'Identify branches with excess vs. deficit stock',
            'Facilitate stock transfer requests between branches',
            'Filter by category or product type per branch',
        ],
        workflow: [
            'Select a branch from the dropdown to see its stock snapshot.',
            'Review the product list with current vs. target stock levels.',
            'For imbalances, initiate an inventory transfer request.',
            'Monitor pending transfer requests in the Inventory Requests tab.',
        ],
    },

    stockAdjustments: {
        title: 'Stock Adjustments',
        description: 'Manually adjust stock quantities for any product at any branch. All adjustments are logged for accountability and audit purposes.',
        keyPoints: [
            'Add, reduce, or correct stock quantities',
            'Select the reason for adjustment (damage, theft, recount, etc.)',
            'All adjustments are logged with staff name and timestamp',
            'View adjustment history per product',
        ],
        workflow: [
            'Click "New Adjustment" and select the product and branch.',
            'Enter the quantity to add (positive) or deduct (negative).',
            'Select a reason from the dropdown (e.g., "Spoilage", "Stock Recount").',
            'Submit — the adjustment is saved and the product\'s stock is updated instantly.',
        ],
    },

    lowStockAlerts: {
        title: 'Low Stock Alerts',
        description: 'A focused view of all products that have fallen below their defined low-stock threshold. Use this to proactively restock before running out.',
        keyPoints: [
            'See all products currently below the low-stock level',
            'Filter by branch or category',
            'Send restock reminders or initiate purchase orders',
            'Set or update the low-stock threshold for any product',
        ],
        workflow: [
            'Review the list of alerted products — sorted by urgency (lowest stock first).',
            'Click a product to view its full stock details and recent sales velocity.',
            'Use the "Restock" quick-action to open the adjustment form.',
            'Update the threshold if the current alert level is not appropriate.',
        ],
    },

    inventoryRequests: {
        title: 'Inventory Requests',
        description: 'View and manage inter-branch stock transfer requests. Branch Managers can request stock from the main warehouse or other branches.',
        keyPoints: [
            'Review pending, approved, and rejected inventory requests',
            'Approve or reject stock transfer requests from branches',
            'See the requested quantity, requested by, and reason',
            'Track fulfilled transfers and update delivery status',
        ],
        workflow: [
            'Open a pending request to review the branch\'s stock need and justification.',
            'Approve the request to authorize the stock transfer.',
            'Coordinate the physical transfer and mark it as "Fulfilled".',
            'Reject requests that cannot be fulfilled with a clear reason.',
        ],
    },

    // ─── DELIVERY PARTNERS ────────────────────────────────────
    allDeliveryPartners: {
        title: 'Fleet Management',
        description: 'Manage your delivery workforce, track partner status, and ensure timely order fulfillment.',
        keyPoints: [
            'Monitor active and inactive delivery partners',
            'Track partner contact information and vehicle types',
            'Review partner performance and total deliveries handled',
            'Manage cash settlements and partner payouts',
        ],
        workflow: [
            'Click "Add Partner" to onboard new delivery personnel.',
            'Use the "Edit" button to update vehicle details or status.',
            'Monitor the "Status" column to see who is available for orders.',
            'Use the "Trash" icon to decommission partners no longer in service.',
        ],
    },

    assignDeliveries: {
        title: 'Assign Deliveries',
        description: 'The core operational hub for dispatching orders. Assign confirmed orders to available delivery partners, manage batches, and track assignment status.',
        keyPoints: [
            'View all orders ready for delivery assignment',
            'See available partners with their current load and location',
            'Assign single or batched orders to a partner',
            'Re-assign orders if a partner is unavailable',
        ],
        workflow: [
            'The left panel shows confirmed, unassigned orders. The right shows available partners.',
            'Select an order and click "Assign" to choose a partner.',
            'For efficiency, batch nearby orders to the same partner.',
            'Once assigned, the partner receives a push notification with order details.',
        ],
    },

    deliveryTracking: {
        title: 'Delivery Tracking',
        description: 'Real-time map view of all active deliveries. Monitor rider locations, estimated delivery times, and flag any delayed or stuck deliveries.',
        keyPoints: [
            'Live map view of all on-duty delivery partners',
            'See each partner\'s current order, customer location, and ETA',
            'Identify deliveries that are delayed or at-risk',
            'Contact a partner directly via the admin panel',
        ],
        workflow: [
            'Open the tracking map to see all active riders as pins.',
            'Click on any rider pin to see their current assignment and status.',
            'If a delivery is late, use the "Contact Partner" button to follow up.',
            'For serious delays, use "Re-Assign" to transfer the order to another rider.',
        ],
    },

    deliverySlots: {
        title: 'Delivery Slots',
        description: 'Define the available delivery time windows that customers can choose from when placing an order. Control slot capacity and manage peak-hour scheduling.',
        keyPoints: [
            'Create, edit, and delete time slot windows (e.g., 10 AM – 12 PM)',
            'Set maximum order capacity per slot to prevent over-booking',
            'Enable or disable specific slots for today or future dates',
            'View slot utilization and booking counts',
        ],
        workflow: [
            'Click "Add Slot" and define the start and end time window.',
            'Set the max order capacity for that slot.',
            'Toggle slot availability on or off based on operational capacity.',
            'Monitor daily slot utilization to optimize delivery scheduling.',
        ],
    },

    cashSettlement: {
        title: 'Cash Settlement',
        description: 'Manage the reconciliation of cash collected by delivery partners for Cash-on-Delivery (COD) orders. Ensure all collected amounts are properly deposited.',
        keyPoints: [
            'View all partners with pending COD cash to settle',
            'Mark cash as "Received" once deposited by the partner',
            'Generate settlement reports per partner or date range',
            'Track settlement history and outstanding balances',
        ],
        workflow: [
            'Review the list of partners with outstanding COD amounts.',
            'When a partner deposits cash, click "Mark as Settled".',
            'Enter the actual received amount and any notes.',
            'The system records the settlement and clears the partner\'s pending balance.',
        ],
    },

    // ─── VENDORS ──────────────────────────────────────────────
    allVendors: {
        title: 'All Vendors',
        description: 'Manage all registered third-party vendor stores on the SaathiGro platform. Each vendor has their own product catalog, orders, and payout system.',
        keyPoints: [
            'View all vendors with their status and product counts',
            'Activate, suspend, or deactivate vendor accounts',
            'View vendor details, contact, and store performance',
            'Access a vendor\'s product catalog directly',
        ],
        workflow: [
            'Browse the vendor list and use the search to find one by name.',
            'Click on a vendor\'s row to open their full profile and store stats.',
            'Use the status toggle to activate or suspend their store access.',
            'Click "Products" to view what they have listed on the platform.',
        ],
    },

    addVendor: {
        title: 'Add Vendor',
        description: 'Onboard a new vendor onto the SaathiGro platform. Create their account, set their store details, and configure their payout settings.',
        keyPoints: [
            'Enter vendor business name, contact, and address',
            'Set bank account details for automated payouts',
            'Assign a commission percentage for the platform',
            'Set initial status (Active/Pending Verification)',
        ],
        workflow: [
            'Fill in the vendor\'s business and contact information.',
            'Enter their bank account details for payout processing.',
            'Set the platform commission percentage agreed upon.',
            'Click "Create Vendor" — they will receive login credentials via SMS/email.',
        ],
    },

    vendorProducts: {
        title: 'Vendor Products',
        description: 'View and manage all products listed by vendors across the platform. Review pending products for approval before they go live in the app.',
        keyPoints: [
            'See all vendor-submitted products across all vendors',
            'Filter by vendor, category, or approval status',
            'Approve or reject vendor-submitted product listings',
            'Edit product details for quality and compliance',
        ],
        workflow: [
            'Filter by "Pending Approval" to review new vendor-submitted products.',
            'Check the product\'s images, pricing, and description for quality.',
            'Click "Approve" to make it live, or "Reject" with feedback to the vendor.',
            'Approved products immediately appear in the customer-facing app.',
        ],
    },

    vendorPayouts: {
        title: 'Vendor Payouts',
        description: 'Manage financial settlements with all vendors. Calculates their earnings net of commission and tracks payout history.',
        keyPoints: [
            'View pending payout amounts per vendor',
            'Review earnings breakdowns: sales, commissions, and net payout',
            'Mark payouts as "Processed" once bank transfer is confirmed',
            'Generate payout reports for accounting',
        ],
        workflow: [
            'Review the list of vendors with outstanding payout amounts.',
            'Click on a vendor to see the itemized sales and commission breakdown.',
            'Transfer the net payout to their registered bank account.',
            'Mark the payout as "Processed" and add a reference/transaction ID.',
        ],
    },

    // ─── LOCATIONS ────────────────────────────────────────────
    allBranches: {
        title: 'Location Management',
        description: 'Configure and monitor physical stores, fulfillment centers, and service areas.',
        keyPoints: [
            'Manage branch-specific contact details and operational hours',
            'Toggle branch status (Active/Closed) based on availability',
            'Track total inventory and staff assigned to each location',
            'Define service radiuses and delivery capabilities per hub',
        ],
        workflow: [
            'Create a new hub or store location with full address details.',
            'Assign a Store Manager to handle local operations.',
            'Update coordinates or status to reflect real-world site changes.',
            'Use "View Info" to see deep details about a branch\'s performance.',
        ],
    },

    // ─── OFFERS & BANNERS ─────────────────────────────────────
    allOffers: {
        title: 'Promotion Banners',
        description: 'Manage high-yield deal banners that appear at the top of the user home screen.',
        keyPoints: [
            'Create visually striking banners with custom imagery',
            'Link banners to specific product collections or categories',
            'Set priority orders for banner rotation on the home screen',
            'Toggle banners on or off based on campaign timelines',
        ],
        workflow: [
            'Upload a high-resolution banner image (1200x400 recommended).',
            'Specify a "Priority" number to control its position in the slider.',
            'Review "Active" status to ensure customers see current deals.',
            'Click "Create New" to launch a seasonally relevant promotion.',
        ],
    },

    allCampaigns: {
        title: 'Dynamic Campaigns',
        description: 'Create themed UI sections like "Festive Deals" or "Lowest Prices" on the mobile app.',
        keyPoints: [
            'Design custom-styled sections with unique backgrounds',
            'Display curated product lists within specialized UI blocks',
            'Set highlight text for "Limited Time" or "Mega Deal" labels',
            'Control campaign visibility without redeploying the app',
        ],
        workflow: [
            'Configure the "Display Type" (Festive or Lowest Prices).',
            'Select a background and text color that fits the theme.',
            'Attach a collection of products to the campaign section.',
            'Use "Hidden" status to prepare campaigns ahead of time.',
        ],
    },

    // ─── PROMO CODES ────────────────────────────────────────
    allPromoCodes: {
        title: 'Promotion Hub',
        description: 'Drive sales by creating and managing discount codes and marketing offers.',
        keyPoints: [
            'Create percentage-based or flat-amount discount codes',
            'Set usage limits (Total or Per User) to control budget',
            'Define minimum order values and expiry dates for campaigns',
            'Track real-time code redemption and effectiveness',
        ],
        workflow: [
            'Click "Create Code" to launch a new marketing promotion.',
            'Specify the discount type and strict eligibility criteria.',
            'Copy the generated code for distribution in notifications.',
            'Monitor the "Usage" column to see how many users redeem an offer.',
        ],
    },

    createPromoCode: {
        title: 'Create Promo Code',
        description: 'Generate a new promotional discount code for customer use. Configure the discount logic, conditions, and usage limits.',
        keyPoints: [
            'Set a custom code string or generate a random one',
            'Choose: flat discount (₹) or percentage (%)',
            'Set minimum order value, maximum discount cap',
            'Set usage limits: total uses and per-customer uses',
            'Set start and expiry date/time',
        ],
        workflow: [
            'Enter the promo code string (e.g., "SAVE50") and select discount type.',
            'Enter the discount value and any minimum cart value requirement.',
            'Set how many times total the code can be used, and how many per customer.',
            'Set the active date window and click "Create Promo Code".',
        ],
    },

    // ─── NOTIFICATIONS ────────────────────────────────────────
    pushNotifications: {
        title: 'Customer Engagement',
        description: 'Send real-time mobile push notifications to re-engage users and announce deals.',
        keyPoints: [
            'Segment audiences (All Users, Specific, Abandoners)',
            'Monitor notification delivery status and history',
            'Craft compelling titles and messages for high CTR',
            'Target recent app users for maximum campaign impact',
        ],
        workflow: [
            'Define your target segment within the creation panel.',
            'Write a clear, actionable title and message body.',
            'Review the history table to see past campaign performance.',
            'Use segmentation to avoid "Notification Fatigue" for users.',
        ],
    },

    adminNotifications: {
        title: 'System Alerts & Inbox',
        description: 'Manage incoming system alerts, inventory warnings, and automated reports targeted to your administrative account.',
        keyPoints: [
            'Monitor critical system-level automated notifications',
            'Mark alerts as read/unread for better organization',
            'Bulk delete older or resolved alerts to keep it clean',
            'Real-time synchronization with the notification gateway',
        ],
        workflow: [
            'Review the subject and body of recent alerts.',
            'Use the multi-select checkbox for bulk actions.',
            'Click the "Check" icon to mark individual items as read.',
            'Use the "Trash" icon for cleanup of legacy alerts.',
        ],
    },

    // ─── SUPPORT DESK ─────────────────────────────────────────
    tickets: {
        title: 'Support Tickets',
        description: 'Handle all customer-raised support requests and complaints. Review, respond, escalate, and resolve tickets to maintain a high customer satisfaction score.',
        keyPoints: [
            'View all open, in-progress, and resolved tickets',
            'Reply to customers directly from the ticket detail view',
            'Assign tickets to a specific staff member',
            'Set ticket priority (Low, Medium, High, Urgent)',
            'Track SLA compliance and resolution times',
        ],
        workflow: [
            'Open the ticket inbox and filter by "Open" or "High Priority".',
            'Click a ticket to read the full customer message and history.',
            'Reply, reassign, or escalate the ticket.',
            'Once resolved, mark it as "Resolved" to close the ticket.',
        ],
    },

    faqs: {
        title: 'FAQs Management',
        description: 'Create and manage Frequently Asked Questions displayed in the customer app support section. Reduce ticket volume by proactively answering common queries.',
        keyPoints: [
            'Add, edit, and delete FAQ entries',
            'Organize FAQs by category (Orders, Payments, Delivery, etc.)',
            'Reorder FAQs to prioritize most common questions',
            'Toggle FAQ visibility instantly',
        ],
        workflow: [
            'Click "Add FAQ" and select the category.',
            'Write a clear question and a comprehensive answer.',
            'Set the display order to prioritize the most-asked questions.',
            'Toggle "Active" to make the FAQ visible in the app.',
        ],
    },

    // ─── REPORTS & ANALYTICS ──────────────────────────────────
    salesReports: {
        title: 'Sales Reports',
        description: 'Analyze transaction history, revenue growth, and order trends over various time periods.',
        keyPoints: [
            'View Total Revenue and Order counts with growth metrics',
            'Track Average Order Value (AOV) trends',
            'Filter transactions by last 30 days, months, or years',
            'Detailed order log with payment and delivery status',
        ],
        workflow: [
            'Select a time period from the dropdown to update all stats.',
            'Review the high-level metrics cards for quick performance checks.',
            'Scroll through the order table to see individual transaction details.',
            'Use "Export CSV" to download the report for accounting.',
        ],
    },

    inventoryReports: {
        title: 'Inventory Reports',
        description: 'Track stock levels, identify low-stock items, and manage product availability across all branches and vendors.',
        keyPoints: [
            'Monitor real-time stock counts and unit types',
            'Filter by category, source (branch/vendor), or status',
            'Identify "Out of Stock" or "Low Stock" items instantly',
            'Export inventory data to CSV for external auditing',
        ],
        workflow: [
            'Use the search bar to find specific products by name or SKU.',
            'Apply filters to narrow down products by category or location.',
            'Click exported buttons like "Out of Stock" to quickly drill down into issues.',
            'Export the current view to maintain offline records.',
        ],
    },

    vendorReports: {
        title: 'Vendor Reports',
        description: 'Evaluate vendor performance, product listings, and total sales contributions to the platform.',
        keyPoints: [
            'Track the number of products listed per vendor',
            'Monitor total sales revenue generated by each store',
            'Review vendor status (Active/Pending) and contact details',
            'Access deep-dive performance stats for specific vendors',
        ],
        workflow: [
            'Search for a vendor by store name or owner.',
            'Identify top-performing vendors by looking at the "Total Sales" column.',
            'Click "View Stats" on a vendor row for more detailed performance metrics.',
            'Export vendor metadata for administrative outreach.',
        ],

    },

    revenueAnalytics: {
        title: 'Revenue Analytics',
        description: 'Deep-dive into financial health with visual growth charts, profit tracking, and daily breakdowns.',
        keyPoints: [
            'Visual Area Chart showing revenue trends over time',
            'Track Net Sales, Refunds, Vendor Payouts, and Net Profit',
            'Compare current period performance vs. previous benchmarks',
            'Daily breakdown table for granular financial tracking',
        ],
        workflow: [
            'Toggle between Week, Month, and Year to see different growth scales.',
            'Hover over the growth chart points to see specific daily revenue.',
            'Review the Net Profit card to understand platform earnings after vendor payouts.',
            'Check the daily breakdown table to spot specific days of high or low performance.',
        ],
    },

    demandAnalytics: {
        title: 'Demand & Lost Sales',
        description: 'Understand customer intent by tracking requests for out-of-stock items and demand in unserviced areas.',
        keyPoints: [
            'Identify "Notify Me" requests for out-of-stock products',
            'Heatmap visualization of order attempts in unserviced zones',
            'Rank highly demanded products to prioritize restocking',
            'Insights for geographical expansion based on density',
        ],
        workflow: [
            'Switch to "Heatmap" view to see clusters of demand in your city.',
            'Look at "Highly Demanded Products" to see what you should source next.',
            'Filter by "Out of Zone" to identify candidate areas for new branch openings.',
            'Review the recent records to see individual customer lost intent.',
        ],
    },

    vendorEarnings: {
        title: 'Vendor Earnings & Payouts',
        description: 'Manage vendor financial settlements, track commissions, and process payout requests.',
        keyPoints: [
            'Monitor "Pending Due" vs "Total Paid Out" for all vendors',
            'Track platform commission earned from vendor transactions',
            'Log of all payout requests with status (Paid/Pending/Failed)',
            'Generate official vendor statements for settlement',
        ],
        workflow: [
            'Filter by "Pending Payouts" to see who needs to be paid.',
            'Click "Details" on any payout row to view the full order breakdown.',
            'Use "Export Statement" to provide vendors with their financial records.',
            'Reconcile payouts with your bank records using Reference IDs.',
        ],
    },

    // ─── SETTINGS ─────────────────────────────────────────────
    adminProfile: {
        title: 'Admin Profile',
        description: 'Manage your personal admin account details including your name, contact information, and login credentials.',
        keyPoints: [
            'Update your display name and profile photo',
            'Change your email and mobile number',
            'Update your password for account security',
            'View your role and permission summary',
        ],
        workflow: [
            'Edit your name, email, or phone and click "Save Changes".',
            'To change password, enter your current password and the new one twice.',
            'Upload a clear profile photo for your admin account.',
        ],
    },

    appSettings: {
        title: 'App Settings',
        description: 'Configure global application settings that affect the behavior and appearance of the SaathiGro customer app.',
        keyPoints: [
            'Set minimum order value for delivery',
            'Configure delivery charge rules (free delivery threshold)',
            'Toggle app maintenance mode',
            'Set default language and currency',
        ],
        workflow: [
            'Review current settings in each category.',
            'Update values like minimum order or delivery fee and click "Save".',
            'For maintenance mode, toggle with caution as it takes the app offline for customers.',
        ],
    },

    billingSettings: {
        title: 'Tax & Billing Settings',
        description: 'Configure taxation rules, GST rates, invoice formats, and billing policies for the platform. Ensure compliance with Indian tax regulations.',
        keyPoints: [
            'Set default GST rates for different product categories',
            'Configure invoice header, footer, and company details',
            'Set up GSTIN and HSN code mapping',
            'Enable or disable automatic invoice generation',
        ],
        workflow: [
            'Review the GSTIN and company details to ensure they are accurate.',
            'Set tax rates for each product category using the tax table.',
            'Customize the invoice template with your business logo and details.',
            'Save settings — all new orders will use these billing configurations.',
        ],
    },

    socialProfile: {
        title: 'Social Profile',
        description: 'Manage the brand\'s social media links and public-facing contact information displayed in the customer app.',
        keyPoints: [
            'Set links to Instagram, Facebook, WhatsApp, and Twitter/X',
            'Add a customer support email and phone number',
            'Update the App Store and Google Play store links',
        ],
        workflow: [
            'Enter the full URL for each social media handle.',
            'Update the support contact info to the current helpdesk details.',
            'Save changes — the links will appear in the app\'s "Contact Us" section.',
        ],
    },

    // ─── LEGAL & POLICIES ─────────────────────────────────────

    legalPolicies: {
        title: 'Legal & Policies',
        description: 'Manage the platform\'s legal documents including Terms of Service, Privacy Policy, Return Policy, and Shipping Policy shown in the customer app.',
        keyPoints: [
            'Edit each policy document using the rich text editor',
            'Update policies to reflect regulatory or business changes',
            'Changes are reflected in the app immediately after saving',
        ],
        workflow: [
            'Select the policy document you want to update from the list.',
            'Edit the content using the rich text editor.',
            'Click "Save Policy" — customers will see the updated version immediately.',
        ],
    },

};
