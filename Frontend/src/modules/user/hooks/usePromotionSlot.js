import { useEffect, useState } from 'react';
import { useShopUI } from '../context/ShopContext';

export const claimPromotion = (current, id, requested) => requested
  ? (current || id) : (current === id ? null : current);

export default function usePromotionSlot(id, requested) {
  const { activePromotion, setActivePromotion } = useShopUI();
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  useEffect(() => {
    const check = () => setExternalDialogOpen([...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .swal2-container')]
      .some(node => !node.closest('[data-promotion-dialog]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
    return () => observer.disconnect();
  }, []);
  const wantsSlot = requested && !externalDialogOpen;
  useEffect(() => {
    setActivePromotion(current => claimPromotion(current, id, wantsSlot));
  }, [id, wantsSlot, activePromotion, setActivePromotion]);
  useEffect(() => () => setActivePromotion(current => claimPromotion(current, id, false)), [id, setActivePromotion]);
  return wantsSlot && activePromotion === id;
}
