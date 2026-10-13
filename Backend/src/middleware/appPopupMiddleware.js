import { assertAppPopupPublisher } from '../services/appPopupService.js';

export const authorizeAppPopup = (req, res, next) => {
  try { assertAppPopupPublisher(req.body, req.admin); next(); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
};
