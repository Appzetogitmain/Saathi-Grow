import cron from 'node-cron';
import Complaint from '../models/Complaint.js';
import OfferDeal from '../models/OfferDeal.js';
import { notifyAdmins, sendPushNotification, notifyByBranchAndPermission } from './notificationService.js';
import { sendBackInStockNotifications } from './backInStockService.js';

/**
 * Initialize all cron jobs
 */
export const initCronJobs = () => {
  cron.schedule('* * * * *', () => sendBackInStockNotifications().catch(error => {
    console.error('[CRON-ERROR] Back-in-stock check failed:', error);
  }));
  // 1. Offer Expiration Monitor (Run every hour)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking for expired offers...');
    try {
      const now = new Date();
      const expiredOffers = await OfferDeal.updateMany(
        { 
          isActive: true, 
          expiryDate: { $lte: now } 
        },
        { $set: { isActive: false } }
      );

      if (expiredOffers.modifiedCount > 0) {
        console.log(`[CRON] Deactivated ${expiredOffers.modifiedCount} expired offers.`);
      }
    } catch (error) {
      console.error('[CRON-ERROR] Offer Expiry Check Failed:', error);
    }
  });

  // 2. SLA Expiry Monitor (Run every hour)
  // Run every hour to check SLA expiry
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking for SLA expirations...');
    try {
      const now = new Date();
      
      // Find tickets that are ESCALATED_TO_STORE and have passed slaExpiry
      const overdueTickets = await Complaint.find({
        status: 'ESCALATED_TO_STORE',
        slaExpiry: { $lt: now }
      }).populate('order');

      if (overdueTickets.length > 0) {
        console.log(`[CRON] Found ${overdueTickets.length} overdue tickets.`);
        
        for (const ticket of overdueTickets) {
          ticket.status = 'OVERDUE';
          await ticket.save();

          // Notify Admins about the escalation failure
          await notifyAdmins({
            title: `SLA BREACH: ${ticket.ticketId}`,
            body: `Store failed to respond to Order #${ticket.order?.orderId} within SLA.`
          }, {
            ticketId: ticket.ticketId,
            type: 'sla_breach'
          });

          // Also Notify the Store via Push (Final Warning)
          if (ticket.storeModel === 'Branch') {
            await notifyByBranchAndPermission('MANAGE_SUPPORT', ticket.store, {
              title: 'CRITICAL: SLA Breach! ⚠️',
              body: `Immediate action required for Ticket ${ticket.ticketId}. SLA expired.`
            }, { ticketId: ticket.ticketId, type: 'critical_sla' });
          } else if (ticket.storeModel === 'Vendor') {
            await sendPushNotification(ticket.store, 'Vendor', {
              title: 'CRITICAL: SLA Breach! ⚠️',
              body: `You failed to respond to Ticket ${ticket.ticketId} on time. Check dashboard.`
            }, { ticketId: ticket.ticketId, type: 'critical_sla' });
          }
        }
      }
    } catch (error) {
      console.error('[CRON-ERROR] SLA Check Failed:', error);
    }
  });

  console.log('[CRON] Support SLA Monitor active (Hourly)');
};
