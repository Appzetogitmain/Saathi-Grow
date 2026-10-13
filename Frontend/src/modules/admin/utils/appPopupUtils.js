const fields = ['isEnabled', 'title', 'message', 'imageUrl', 'actionType', 'actionTarget', 'buttonText'];
export const canPublishPopup = admin => admin?.role === 'Admin' || admin?.permissions?.includes('MANAGE_SETTINGS') === true;
export const canAttachPopup = (admin, targetType, group) => canPublishPopup(admin) && targetType === 'broadcast' && ['users', 'all'].includes(group);
const content = popup => Object.fromEntries(fields.map(field => [field, field === 'isEnabled'
  ? Boolean(popup?.[field]) : String(popup?.[field] || (field === 'actionType' ? 'home' : field === 'buttonText' ? 'Shop Now' : '')).trim()]));
export const buildAppSettingsUpdate = (settings, initialPopup) => {
  const updates = { ...settings };
  const current = content(settings.appPopup), initial = content(initialPopup);
  const changed = Object.fromEntries(fields.filter(field => current[field] !== initial[field]).map(field => [field, current[field]]));
  if (!Object.keys(changed).length) delete updates.appPopup;
  else updates.appPopup = { ...changed, version: settings.appPopup?.version };
  return updates;
};
