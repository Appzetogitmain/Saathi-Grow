import React, { useEffect } from 'react';
import { generateToken, onMessageListener } from '../../config/firebase';
import { toast } from 'react-toastify';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiConfig';
import Swal from 'sweetalert2';

/**
 * Handles Firebase Notification registration and foreground messages.
 * 
 * @param {string} token - The auth token (JWT) for the current user.
 * @param {string} role - The role of the user ('user', 'admin', 'vendor', 'delivery').
 * @param {boolean} isApp - Whether the app is running in a Flutter wrap.
 */
const FirebaseNotificationHandler = ({ token, role, isApp = false, showToast = false }) => {
  const resolveNotificationLink = (payloadData = {}) => {
    if (payloadData?.link) return payloadData.link;
    if (payloadData?.orderId && role === 'user') return `/orders/${payloadData.orderId}`;
    return '/notifications';
  };
  
  useEffect(() => {
    const setupNotifications = async () => {
      if (!token) return;

      try {
        // Force update any existing Service Worker registration to get latest click handler
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((reg) => reg.update());
          }).catch(() => {});
        }

        // 1. Get FCM Token
        const fcmToken = await generateToken();
        if (fcmToken) {
          // console.log(`FCM Token registered for ${role}:`, fcmToken);
          
          // 2. Determine API Endpoint based on role
          let endpoint = '';
          switch (role) {
            case 'user': endpoint = `${API_BASE_URL}/user/fcm-token`; break;
            case 'admin': 
            case 'staff':
            case 'store-manager':
              endpoint = `${API_BASE_URL}/admin/fcm-token`; break;

            case 'vendor': endpoint = `${API_BASE_URL}/vendors/fcm-token`; break;
            case 'delivery': endpoint = `${API_BASE_URL}/delivery/fcm-token`; break;
            default: endpoint = `${API_BASE_URL}/auth/fcm-token`;
          }

          // 3. Send token to backend
          await axios.put(endpoint, {
            fcmToken: fcmToken,
            platform: isApp ? 'app' : 'web'
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // 4. Set up Foreground message listener
    const unsubscribe = onMessageListener((payload) => {
      // console.log('Foreground Message received: ', payload);
      
      const title = payload.notification?.title || payload.data?.title || 'New Notification';
      const body = payload.notification?.body || payload.data?.body || '';

      // Trigger native notification in foreground if permission is granted (uses ServiceWorker on mobile)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body: body,
                icon: '/favicon.png',
                badge: '/favicon.png',
                tag: payload.data?.runId || payload.data?.orderId || undefined,
                data: payload.data || {}
              });
            }).catch(() => {});
          } else {
            const nativeNotification = new Notification(title, {
              body: body,
              icon: '/favicon.png',
              badge: '/favicon.png',
              tag: payload.data?.runId || payload.data?.orderId || undefined,
              requireInteraction: ['assignment', 'run_assignment', 'return_batch'].includes(payload.data?.type)
            });
            nativeNotification.onclick = () => {
              const target = resolveNotificationLink(payload.data || {});
              if (target.startsWith('http')) {
                window.location.href = target;
                return;
              }
              window.location.href = `${window.location.origin}${target}`;
            };
          }
        } catch (e) {
          console.error('Error displaying native foreground notification:', e);
        }
      }

      const popupTypes = ['admin_message', 'resolution', 'ticket_closed', 'store_response', 'admin_broadcast', 'individual'];
      
      if (role === 'user' || popupTypes.includes(payload.data?.type)) {
        const type = payload.data?.type;
        const icon = (type === 'resolution' || type === 'ticket_closed') ? 'success' : 'info';
        Swal.fire({
          title: title,
          text: body,
          icon: icon,
          confirmButtonText: 'Got it!',
          confirmButtonColor: '#2563eb',
          customClass: { popup: 'rounded-3xl' }
        });
      } else if (showToast) {
        // Skip default toast for delivery assignment runs so they only get the high-priority fullscreen modal overlay
        const isDeliveryAssignment = role === 'delivery' && (
          title.toLowerCase().includes('assign') ||
          title.toLowerCase().includes('pickup') ||
          ['assignment', 'run_assignment', 'return_batch'].includes(payload.data?.type)
        );

        if (!isDeliveryAssignment) {
          toast.info(
            <div className="flex flex-col gap-1">
              <strong className="font-bold text-sm">{title}</strong>
              <span className="text-xs opacity-90">{body}</span>
            </div>,
            {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              theme: "colored"
            }
          );
        }
      }

      // Dispatch a custom event so other components can react (e.g., show a big modal for new orders)
      const event = new CustomEvent('onFirebaseMessage', { detail: payload });
      window.dispatchEvent(event);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };

  }, [token, role, isApp]);

  return null; // This component doesn't render anything
};

export default FirebaseNotificationHandler;
