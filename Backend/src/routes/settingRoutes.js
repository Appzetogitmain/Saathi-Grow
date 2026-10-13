import express from 'express';
import { getSettings, updateSettings, getPublicSettings, uploadPopupImage } from '../controllers/settingController.js';
import { memoryUpload } from '../config/cloudinary.js';
import { protectAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for App / Frontend
router.get('/public', getPublicSettings);

// WebView Download proxy endpoint to avoid blob/data scheme restriction on mobile devices
router.post('/download', (req, res) => {
    const { content, fileName, contentType, isBase64 } = req.body;
    if (!content || !fileName) {
        return res.status(400).send('Content and fileName are required');
    }
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    if (isBase64 || isBase64 === 'true') {
        const buffer = Buffer.from(content, 'base64');
        return res.status(200).send(buffer);
    }
    return res.status(200).send(content);
});

// Admin Routes for Dashboard
router.get('/', protectAdmin, requirePermission('MANAGE_SETTINGS'), getSettings);
router.put('/', protectAdmin, requirePermission('MANAGE_SETTINGS'), updateSettings);
router.post('/upload-popup-image', protectAdmin, requirePermission('MANAGE_SETTINGS'), memoryUpload.single('image'), uploadPopupImage);

export default router;
