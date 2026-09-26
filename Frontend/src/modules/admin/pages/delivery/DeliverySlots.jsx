import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit, Trash2, Calendar, LayoutGrid, ArrowLeft, Loader2, Save, X, Info, Power, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import * as api from '../../api/deliverySlotApi';
import { showDeleteConfirmation } from '../../../../common/utils/alertUtils';
import { getAdminSettings, updateAdminSettings } from '../../../../common/api/settingApi';

const DeliverySlots = () => {
    const { t } = useTranslation('admin_delivery');
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [deliverySettings, setDeliverySettings] = useState(null);
    const [savingImmediate, setSavingImmediate] = useState(false);
    const [formData, setFormData] = useState({
        label: '',
        startTime: '06:00',
        endTime: '08:00',
        maxOrders: 50,
        isActive: true
    });

    // Phase 8: Holiday Management States
    const [holidays, setHolidays] = useState([]);
    const [loadingHolidays, setLoadingHolidays] = useState(false);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [savingHoliday, setSavingHoliday] = useState(false);
    const [holidayFormData, setHolidayFormData] = useState({
        date: '',
        name: '',
        reason: ''
    });

    // Role check
    const isVendor = window.location.pathname.startsWith('/vendor');

    const fetchSlots = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            const data = await api.getAdminDeliverySlots();
            setSlots(data || []);
        } catch (error) {
            console.error("Slots fetch failed", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchHolidays = async () => {
        if (isVendor) return;
        try {
            setLoadingHolidays(true);
            const data = await api.getAdminHolidays();
            setHolidays(data.holidays || []);
        } catch (error) {
            console.error("Holidays fetch failed", error);
        } finally {
            setLoadingHolidays(false);
        }
    };

    useEffect(() => {
        fetchSlots();
        if (!isVendor) {
            getAdminSettings().then(setDeliverySettings).catch((error) => console.error('Settings fetch failed', error));
            fetchHolidays();
        }
    }, [isVendor]);

    const toggleImmediateDelivery = async () => {
        if (!deliverySettings || savingImmediate) return;
        setSavingImmediate(true);
        try {
            const updated = await updateAdminSettings(null, {
                immediateDeliveryEnabled: !deliverySettings.immediateDeliveryEnabled
            });
            setDeliverySettings(updated);
        } catch (error) {
            Swal.fire({ title: 'Unable to update Immediate Delivery', text: error.response?.data?.message, icon: 'error' });
        } finally {
            setSavingImmediate(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEdit = (slot) => {
        setSelectedSlot(slot);
        setFormData({
            label: slot.label,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxOrders: slot.maxOrders,
            isActive: slot.isActive
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (selectedSlot) {
                await api.updateDeliverySlot(selectedSlot._id, formData);
            } else {
                await api.createDeliverySlot(formData);
            }
            setShowModal(false);
            fetchSlots();
            Swal.fire({
                title: 'Slot Board Updated',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire({
                title: 'Failed to save slot',
                text: error.response?.data?.message || error.message,
                icon: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await showDeleteConfirmation(
            'Delete this time window?',
            "Customers won't see this slot anymore."
        );

        if (result.isConfirmed) {
            try {
                await api.deleteDeliverySlot(id);
                fetchSlots();
                Swal.fire({
                    title: 'Slot Removed',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire({
                    title: 'Action Failed',
                    text: error.response?.data?.message || 'Unable to delete slot.',
                    icon: 'error'
                });
            }
        }
    };

    // Holiday Management Actions
    const handleAddHoliday = async (e) => {
        e.preventDefault();
        if (!holidayFormData.date || !holidayFormData.name.trim()) {
            Swal.fire({ title: 'Validation Error', text: 'Date and holiday name are required.', icon: 'warning' });
            return;
        }

        setSavingHoliday(true);
        try {
            const res = await api.addAdminHoliday(holidayFormData);
            setHolidays(res.holidays || []);
            setShowHolidayModal(false);
            setHolidayFormData({ date: '', name: '', reason: '' });
            Swal.fire({
                title: 'Holiday Scheduled',
                text: `${holidayFormData.name} scheduled for ${holidayFormData.date}`,
                icon: 'success',
                timer: 1800,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire({
                title: 'Failed to add holiday',
                text: error.response?.data?.message || error.message,
                icon: 'error'
            });
        } finally {
            setSavingHoliday(false);
        }
    };

    const handleDeleteHoliday = async (date, name) => {
        const result = await showDeleteConfirmation(
            `Remove ${name || 'holiday'}?`,
            `Deliveries will become available on ${date} again.`
        );

        if (result.isConfirmed) {
            try {
                const res = await api.deleteAdminHoliday(date);
                setHolidays(res.holidays || []);
                Swal.fire({
                    title: 'Holiday Removed',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire({
                    title: 'Failed to remove holiday',
                    text: error.response?.data?.message || error.message,
                    icon: 'error'
                });
            }
        }
    };

    const todayDateStr = new Date().toISOString().split('T')[0];

    return (
        <div className="container-fluid py-6 bg-slate-50/30 min-h-screen px-4 md:px-6 max-w-7xl mx-auto font-sans text-slate-800">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">Delivery Shifts & Holidays</h1>
                    <p className="text-slate-500 text-xs mt-1 font-bold opacity-70 uppercase tracking-tight">Configure scheduled fulfillment shifts, capacities, and shop holidays</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => { fetchSlots(true); fetchHolidays(); }}
                        disabled={refreshing}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl transition-all shadow-sm hover:border-blue-500 active:scale-95 text-slate-600 disabled:opacity-50"
                        title="Sync Shifts"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    {!isVendor && (
                        <>
                            <button
                                onClick={() => {
                                    setHolidayFormData({ date: '', name: '', reason: '' });
                                    setShowHolidayModal(true);
                                }}
                                className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                                <Calendar size={16} />
                                <span>Add Shop Holiday</span>
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedSlot(null);
                                    setFormData({ label: '', startTime: '06:00', endTime: '08:00', maxOrders: 50, isActive: true });
                                    setShowModal(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                                <Plus size={16} />
                                <span>New Shift</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Quick Dispatch / Immediate Delivery Setting Banner */}
            {!isVendor && deliverySettings && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${deliverySettings.immediateDeliveryEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Power size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Express / Immediate Delivery</h3>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-tight ${deliverySettings.immediateDeliveryEnabled ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                    {deliverySettings.immediateDeliveryEnabled ? 'Online' : 'Suspended'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                When enabled, customers can choose Instant / ASAP delivery without selecting a delivery slot.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleImmediateDelivery}
                        disabled={savingImmediate}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 active:scale-95 ${deliverySettings.immediateDeliveryEnabled ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                        {savingImmediate ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span>{deliverySettings.immediateDeliveryEnabled ? 'Turn Off Instant Delivery' : 'Turn On Instant Delivery'}</span>
                    </button>
                </div>
            )}

            {/* Table Area for Delivery Shifts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10 animate-in fade-in duration-300">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Scheduled Delivery Slots</h2>
                        <p className="text-[11px] text-slate-400 font-medium">Standard customer delivery shifts available on regular business days</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-8 py-4">Shift Title</th>
                                <th className="px-6 py-4 text-center">Fulfillment Starts</th>
                                <th className="px-6 py-4 text-center">Fulfillment Ends</th>
                                <th className="px-6 py-4 text-center">Order Capacity</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                {!isVendor && <th className="px-8 py-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={isVendor ? "5" : "6"} className="px-8 py-5">
                                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : slots.length > 0 ? (
                                slots.map((slot) => (
                                    <tr key={slot._id} className="hover:bg-slate-50/30 transition-colors group">
                                        <td className="px-8 py-5 font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{slot.label}</td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">{slot.startTime}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">{slot.endTime}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-xs font-bold text-slate-900">{slot.maxOrders}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-tight ${
                                                slot.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                                            }`}>
                                                {slot.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        {!isVendor && (
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleEdit(slot)}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95"
                                                        title="Edit Slot"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(slot._id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95"
                                                        title="Delete Slot"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={isVendor ? "5" : "6"} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                <Clock size={28} className="text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">No timeslots configured yet</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Phase 8: Shop Holiday Management Section */}
            {!isVendor && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-12 animate-in fade-in duration-300">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-amber-500" />
                                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Shop Holidays & Closed Dates</h2>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                Customers cannot book delivery on scheduled holiday dates. The multi-day slot selector automatically skips these days.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setHolidayFormData({ date: '', name: '', reason: '' });
                                setShowHolidayModal(true);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm shrink-0"
                        >
                            <Plus size={15} />
                            <span>Add Holiday Date</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-8 py-4">Holiday Date</th>
                                    <th className="px-6 py-4">Holiday Name</th>
                                    <th className="px-6 py-4">Reason / Notes</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-8 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium">
                                {loadingHolidays ? (
                                    Array(2).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan="5" className="px-8 py-5">
                                                <div className="h-4 bg-slate-100 rounded w-full"></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : holidays.length > 0 ? (
                                    holidays.map((h, idx) => {
                                        const isPast = h.date < todayDateStr;
                                        const isToday = h.date === todayDateStr;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-5">
                                                    <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                                        {h.date}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 font-bold text-slate-800">
                                                    {h.name}
                                                </td>
                                                <td className="px-6 py-5 text-slate-500">
                                                    {h.reason || <span className="italic text-slate-300">None specified</span>}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-tight ${
                                                        isToday
                                                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                            : isPast
                                                            ? 'bg-slate-50 text-slate-400 border-slate-200'
                                                            : 'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        {isToday ? 'Today (Closed)' : isPast ? 'Past' : 'Upcoming'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button
                                                        onClick={() => handleDeleteHoliday(h.date, h.name)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95"
                                                        title="Delete Holiday"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                                                    <Calendar size={24} />
                                                </div>
                                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">No shop holidays scheduled</p>
                                                <p className="text-slate-300 text-xs">Deliveries will be available every day according to regular shift hours.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Slot Form Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in duration-300">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{selectedSlot ? 'Update Window' : 'New Delivery Shift'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Label Name</label>
                                <input
                                    type="text"
                                    name="label"
                                    value={formData.label}
                                    onChange={handleChange}
                                    required
                                    placeholder="e.g. Morning Shift"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                                    <input
                                        type="time"
                                        name="startTime"
                                        value={formData.startTime}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                                    <input
                                        type="time"
                                        name="endTime"
                                        value={formData.endTime}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Max Shipments</label>
                                <input
                                    type="number"
                                    name="maxOrders"
                                    value={formData.maxOrders}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className={`w-10 h-6 rounded-full relative transition-all cursor-pointer ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => setFormData({...formData, isActive: !formData.isActive})}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.isActive ? 'left-5' : 'left-1'}`} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight italic">Mark as Active</span>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-50">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-400 font-bold text-xs hover:bg-slate-50 rounded-xl transition-all border border-transparent">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all border-none">Save Slot</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Phase 8: Holiday Form Modal */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHolidayModal(false)} />
                    
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in duration-300">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Add Shop Holiday</h3>
                            <button onClick={() => setShowHolidayModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddHoliday} className="p-8 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Holiday Date</label>
                                <input
                                    type="date"
                                    min={todayDateStr}
                                    value={holidayFormData.date}
                                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, date: e.target.value }))}
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Holiday Name / Occasion</label>
                                <input
                                    type="text"
                                    value={holidayFormData.name}
                                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    placeholder="e.g. Diwali, Store Maintenance, Republic Day"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason / Notes (Optional)</label>
                                <textarea
                                    value={holidayFormData.reason}
                                    onChange={(e) => setHolidayFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="e.g. Annual stock audit; delivery teams off duty"
                                    rows="2"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all text-xs font-medium text-slate-700 resize-none"
                                />
                            </div>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2.5 text-amber-800 text-[11px] leading-snug">
                                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                                <span>On this date, customers will see that the shop is closed and cannot book delivery slots.</span>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowHolidayModal(false)}
                                    className="flex-1 py-3 text-slate-400 font-bold text-xs hover:bg-slate-50 rounded-xl transition-all border border-transparent"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingHoliday}
                                    className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-100 transition-all border-none flex items-center justify-center gap-2"
                                >
                                    {savingHoliday ? <Loader2 size={15} className="animate-spin" /> : null}
                                    <span>Schedule Holiday</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .scrollbar-thin::-webkit-scrollbar { height: 4px; border-radius: 10px; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}} />
        </div>
    );
};

export default DeliverySlots;
