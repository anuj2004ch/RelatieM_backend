import express from 'express';
import { upload } from '../lib/cloudinary.js';
import { v2 as cloudinary } from 'cloudinary';
import {protectRoute} from '../middleware/auth.middleware.js'; // Optional: Protect your route
// import { isAuthenticated } from '../middleware/auth.js'; // Optional: Protect your route

const router = express.Router();
router.use(protectRoute); // Optional: Protect your route

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        error: 'File upload failed',
        details: err.message,
      });
    }

    if (!req.file) {
      console.error('No file received in request');
      return res.status(400).json({
        error: 'No file uploaded',
        details: 'File field is required',
      });
    }

    // On successful upload, Cloudinary provides a 'public_id' in the response.
    // It's crucial to save this req.file.public_id to your database.
    console.log('File uploaded successfully:', req.file.path);
    console.log('Public ID:', req.file.public_id);
    
    res.status(200).json({
      mediaUrl: req.file.path,
      mediaType: req.file.mimetype,
      publicId: req.file.filename, // Send public_id to the frontend
    });
  });
});


// ✅ ROUTE 2: Generate a signed URL for a private file (new code)
// Note: You should protect this route with authentication/authorization middleware
// so only logged-in users who have permission can access the files.
// router.post('/get-signed-url', isAuthenticated, (req, res) => {
router.post('/get-signed-url', (req, res) => {
  // public_id and resourceType are sent from the frontend
  const { public_id, resource_type } = req.body;

  if (!public_id) {
    return res.status(400).json({ message: 'File public_id is required' });
  }

  try {
    // Determine the options for the signed URL
    const options = {
      resource_type: resource_type || 'raw', // Default to 'raw' if not provided
      type: 'upload',
      attachment: true, // This suggests to the browser to download the file
      expires_at: Math.floor(Date.now() / 1000) + 60, // Link expires in 60 seconds
    };

    // Generate a signed URL for downloading
    const signedUrl = cloudinary.utils.private_download_url(public_id, '', options);

    res.status(200).json({ signedUrl });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ message: 'Server error while generating download link.' });
  }
});


export default router;