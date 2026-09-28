import React, { useState, useMemo, useEffect } from 'react';
import { useShop } from '../../context/ShopContext';
import { Calendar, AlertCircle, Clock, X, Sparkles, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Calculates current date string (YYYY-MM-DD) in the specified timezone
 */
const getZonedDateString = (date = new Date(), timeZone = 'Asia/Kolkata') => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }
};

/**
 * Computes calendar day difference between todayStr and targetStr (both YYYY-MM-DD)
 */
const getDayDifference = (todayStr, targetStr) => {
  const [y1, m1, d1] = todayStr.split('-').map(Number);
  const [y2, m2, d2] = targetStr.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86400000);
};

const HolidayNoticeBanner = () => {
  const { settings, loading } = useShop();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedDates, setDismissedDates] = useState(() => {
    try {
      const stored = sessionStorage.getItem('saathi_dismissed_holidays');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Calculate upcoming holidays within 2-day window (diff = 0, 1, 2)
  const activeHolidays = useMemo(() => {
    if (loading || !settings?.holidays || !Array.isArray(settings.holidays) || settings.holidays.length === 0) {
      return [];
    }

    const timezone = settings.deliveryTimezone || 'Asia/Kolkata';
    const todayStr = getZonedDateString(new Date(), timezone);

    return settings.holidays
      .map(holiday => {
        if (!holiday?.date || !/^\d{4}-\d{2}-\d{2}$/.test(holiday.date)) return null;
        const diff = getDayDifference(todayStr, holiday.date);
        
        // Show 2 days prior (diff === 2), 1 day prior (diff === 1), and on holiday (diff === 0)
        if (diff < 0 || diff > 2) return null;

        const [y, m, d] = holiday.date.split('-').map(Number);
        const holidayDateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const formattedDate = new Intl.DateTimeFormat('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC'
        }).format(holidayDateObj);

        return {
          ...holiday,
          diff,
          formattedDate,
          isToday: diff === 0,
          isTomorrow: diff === 1,
          isTwoDaysAway: diff === 2
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.diff - b.diff);
  }, [settings?.holidays, settings?.deliveryTimezone, loading]);

  // Filter out holidays dismissed by the user in this session
  const visibleHolidays = useMemo(() => {
    return activeHolidays.filter(h => !dismissedDates.includes(h.date));
  }, [activeHolidays, dismissedDates]);

  // Handle multi-holiday auto rotation
  useEffect(() => {
    if (visibleHolidays.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleHolidays.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [visibleHolidays.length]);

  // Ensure current index is valid
  useEffect(() => {
    if (currentIndex >= visibleHolidays.length) {
      setCurrentIndex(0);
    }
  }, [visibleHolidays.length, currentIndex]);

  const handleDismiss = (holidayDate) => {
    try {
      const updated = [...dismissedDates, holidayDate];
      setDismissedDates(updated);
      sessionStorage.setItem('saathi_dismissed_holidays', JSON.stringify(updated));
    } catch {
      // Fallback
    }
  };

  if (visibleHolidays.length === 0) return null;

  const currentHoliday = visibleHolidays[currentIndex] || visibleHolidays[0];
  if (!currentHoliday) return null;

  const { isToday, isTomorrow, isTwoDaysAway, name, reason, formattedDate, date, diff } = currentHoliday;

  // Visual Theme Config based on urgency
  let themeConfig = {
    gradient: 'from-amber-500/15 via-orange-500/10 to-amber-500/15 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40',
    borderColor: 'border-amber-300/60 dark:border-amber-700/50',
    badgeBg: 'bg-amber-500 text-white dark:bg-amber-500',
    badgeText: 'UPCOMING HOLIDAY',
    iconColor: 'text-amber-600 dark:text-amber-400',
    headline: `Shop closed on ${formattedDate} (${name})`,
    subtext: reason || 'Please place your grocery deliveries in advance to avoid delay.',
    actionNote: 'Order early!'
  };

  if (isToday) {
    themeConfig = {
      gradient: 'from-rose-500/15 via-red-500/10 to-rose-500/15 dark:from-rose-950/50 dark:via-red-950/40 dark:to-rose-950/50',
      borderColor: 'border-rose-300/70 dark:border-rose-700/60',
      badgeBg: 'bg-rose-600 text-white dark:bg-rose-600',
      badgeText: 'STORE CLOSED TODAY',
      iconColor: 'text-rose-600 dark:text-rose-400',
      headline: `We are closed today for ${name}`,
      subtext: reason ? `${reason}. Deliveries will resume tomorrow.` : 'Delivery slots will resume tomorrow. You can still schedule orders for upcoming days!',
      actionNote: 'Deliveries paused today'
    };
  } else if (isTomorrow) {
    themeConfig = {
      gradient: 'from-orange-500/15 via-amber-500/10 to-orange-500/15 dark:from-orange-950/50 dark:via-amber-950/40 dark:to-orange-950/50',
      borderColor: 'border-orange-300/70 dark:border-orange-700/60',
      badgeBg: 'bg-orange-600 text-white dark:bg-orange-600',
      badgeText: 'STORE CLOSED TOMORROW',
      iconColor: 'text-orange-600 dark:text-orange-400',
      headline: `Deliveries paused tomorrow, ${formattedDate} (${name})`,
      subtext: reason ? `${reason}. Order today for same-day delivery!` : 'Order today to get your groceries delivered on time!',
      actionNote: 'Order today for prompt delivery'
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3 md:mt-5 mb-3 md:mb-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={date}
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className={`relative overflow-hidden rounded-xl md:rounded-2xl border ${themeConfig.borderColor} bg-gradient-to-r ${themeConfig.gradient} backdrop-blur-md shadow-sm transition-all duration-300 p-3.5 sm:p-4.5`}
        >
          {/* Subtle Shimmer Background Accent */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-amber-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start sm:items-center justify-between gap-3 relative z-10">
            {/* Left Icon + Text Section */}
            <div className="flex items-start sm:items-center gap-3 md:gap-4 flex-grow min-w-0">
              {/* Responsive Icon Badge */}
              <div className={`flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-white dark:bg-gray-900 shadow-sm border border-black/5 dark:border-white/10 ${themeConfig.iconColor}`}>
                {isToday ? (
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                ) : isTomorrow ? (
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" style={{ animationDuration: '2s' }} />
                ) : (
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              {/* Message Content */}
              <div className="flex-grow min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-xs ${themeConfig.badgeBg}`}>
                    <Sparkles className="w-2.5 h-2.5" />
                    {themeConfig.badgeText}
                  </span>

                  {visibleHolidays.length > 1 && (
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400">
                      ({currentIndex + 1} of {visibleHolidays.length})
                    </span>
                  )}
                </div>

                <h4 className="text-xs sm:text-sm md:text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight line-clamp-1 sm:line-clamp-none">
                  {themeConfig.headline}
                </h4>

                <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2 sm:line-clamp-1 leading-snug">
                  {themeConfig.subtext}
                </p>
              </div>
            </div>

            {/* Right Action & Controls */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-1">
              {/* Multi-item Carousel Controls */}
              {visibleHolidays.length > 1 && (
                <div className="flex items-center gap-0.5 bg-white/70 dark:bg-gray-900/70 rounded-lg p-0.5 border border-black/5 dark:border-white/10">
                  <button
                    onClick={() => setCurrentIndex(prev => (prev === 0 ? visibleHolidays.length - 1 : prev - 1))}
                    className="p-1 rounded text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    aria-label="Previous holiday"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentIndex(prev => (prev + 1) % visibleHolidays.length)}
                    className="p-1 rounded text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    aria-label="Next holiday"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Dismiss Button */}
              <button
                onClick={() => handleDismiss(date)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="Dismiss notice"
                aria-label="Dismiss holiday notice"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default HolidayNoticeBanner;
