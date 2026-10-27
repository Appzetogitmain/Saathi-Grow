import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import http from 'node:http';
import express from 'express';
import {
  uploadsRootDir,
  uploadBufferToCloudinary,
  cloudinary,
  getBaseUrl,
  upload,
  productImageUpload,
  deliveryPartnerUploadFields
} from '../src/config/cloudinary.js';

test('LOCAL STORAGE: uploadBufferToCloudinary saves buffer to disk and returns public URL', async () => {
  const sampleBuffer = Buffer.from('Fake PNG image content header \x89PNG\r\n\x1a\n');
  const result = await uploadBufferToCloudinary({
    buffer: sampleBuffer,
    folder: 'saathigro/products',
    publicId: 'test-product-sample'
  });

  assert.ok(result.secure_url, 'Must return secure_url');
  assert.ok(result.url, 'Must return url');
  assert.ok(result.public_id, 'Must return public_id');
  assert.match(result.secure_url, /\/api\/uploads\/products\/test-product-sample\./);
  assert.match(result.public_id, /^api\/uploads\/products\/test-product-sample\./);

  // Verify file was written to disk
  const expectedDiskFile = path.join(uploadsRootDir, 'products', path.basename(result.secure_url));
  assert.ok(fs.existsSync(expectedDiskFile), `File must exist at ${expectedDiskFile}`);

  // Test cloudinary.uploader.destroy unlinks the local file
  const destroyResult = await cloudinary.uploader.destroy(result.public_id);
  assert.equal(destroyResult.result, 'ok');
  assert.ok(!fs.existsSync(expectedDiskFile), 'File should be removed from disk after destroy');
});

test('LOCAL STORAGE: cloudinary.uploader.destroy gracefully handles non-existent file or external id', async () => {
  const result1 = await cloudinary.uploader.destroy('non_existent_file_id_12345');
  assert.equal(result1.result, 'ok');

  const result2 = await cloudinary.uploader.destroy(null);
  assert.equal(result2.result, 'not found');
});

test('LOCAL STORAGE: getBaseUrl resolves accurately', () => {
  const mockReq = {
    protocol: 'https',
    headers: { host: 'saathigro.in' },
    get: (header) => (header === 'host' ? 'saathigro.in' : null)
  };
  const urlFromReq = getBaseUrl(mockReq);
  assert.ok(urlFromReq.includes('saathigro.in'));

  const defaultUrl = getBaseUrl();
  assert.ok(typeof defaultUrl === 'string' && defaultUrl.length > 0);
});

test('LOCAL STORAGE: Multer instances and field middleware are properly configured', () => {
  assert.ok(upload, 'upload middleware should exist');
  assert.ok(productImageUpload, 'productImageUpload middleware should exist');
  assert.ok(deliveryPartnerUploadFields, 'deliveryPartnerUploadFields middleware should exist');
  assert.equal(typeof deliveryPartnerUploadFields, 'function');
});

test('LOCAL STORAGE E2E: Express multipart upload and static file serving on /api/uploads', async () => {
  const app = express();

  // Static serving
  const staticUploadOptions = {
    maxAge: '30d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  };
  app.use('/uploads', express.static(uploadsRootDir, staticUploadOptions));
  app.use('/api/uploads', express.static(uploadsRootDir, staticUploadOptions));

  // Route with upload.single
  app.post('/test/upload-single', upload.single('profileImage'), (req, res) => {
    res.json({
      success: true,
      file: {
        path: req.file.path,
        filename: req.file.filename,
        public_id: req.file.public_id,
        size: req.file.size
      }
    });
  });

  // Route with productImageUpload.fields
  app.post('/test/upload-product', productImageUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 3 }
  ]), (req, res) => {
    res.json({
      success: true,
      imagePath: req.files?.image?.[0]?.path,
      galleryPaths: (req.files?.gallery || []).map(f => f.path)
    });
  });

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test single file upload
    const formData = new FormData();
    const fakeBlob = new Blob(['Test single image bytes'], { type: 'image/png' });
    formData.append('profileImage', fakeBlob, 'my_avatar.png');

    const res = await fetch(`${baseUrl}/test/upload-single`, {
      method: 'POST',
      body: formData
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.success);
    assert.ok(json.file.path.startsWith(baseUrl), 'Path must use the server baseUrl');
    assert.match(json.file.path, /\/api\/uploads\/admin-profiles\/profileImage-.*\.png$/);

    // 2. Test GET static file delivery via /api/uploads
    const fileRes = await fetch(json.file.path);
    assert.equal(fileRes.status, 200);
    const fileText = await fileRes.text();
    assert.equal(fileText, 'Test single image bytes');
    assert.equal(fileRes.headers.get('cross-origin-resource-policy'), 'cross-origin');

    // 3. Test product fields upload (image + gallery)
    const productFormData = new FormData();
    productFormData.append('image', new Blob(['Main product pic'], { type: 'image/jpeg' }), 'main.jpg');
    productFormData.append('gallery', new Blob(['Gallery pic 1'], { type: 'image/jpeg' }), 'g1.jpg');
    productFormData.append('gallery', new Blob(['Gallery pic 2'], { type: 'image/jpeg' }), 'g2.jpg');

    const prodRes = await fetch(`${baseUrl}/test/upload-product`, {
      method: 'POST',
      body: productFormData
    });
    assert.equal(prodRes.status, 200);
    const prodJson = await prodRes.json();
    assert.ok(prodJson.imagePath.includes('/api/uploads/products/'));
    assert.equal(prodJson.galleryPaths.length, 2);
    assert.ok(prodJson.galleryPaths[0].includes('/api/uploads/products/'));

    // Clean up created test files
    await cloudinary.uploader.destroy(json.file.public_id);
  } finally {
    server.close();
  }
});
