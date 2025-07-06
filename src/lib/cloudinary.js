// import { v2 as cloudinary } from 'cloudinary';
// import { CloudinaryStorage } from 'multer-storage-cloudinary';
// import multer from 'multer';
// import path from 'path'; // ✅ Import path module

// // ✅ Configure Cloudinary (ensure this runs once when your app starts)
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // ✅ Dynamic Cloudinary storage config with proper resource_type handling
// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: async (req, file) => {
//     const mime = file.mimetype;

//     // ✅ Treat PDFs, DOCs, TXT, and audio files as 'raw'
//    const rawMimeTypes = [
//   'application/pdf',
//   'application/msword',
//   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//   'application/vnd.ms-powerpoint', // for .ppt
//   'application/vnd.openxmlformats-officedocument.presentationml.presentation', // for .pptx
//   'text/plain',
// ];

//     const isRaw = rawMimeTypes.includes(mime) || mime.startsWith('audio/');
    
//     // ✅ Get the filename without the extension
//     const fileName = path.parse(file.originalname).name.replace(/\s+/g, '_');

//     return {
//       folder: 'chat-uploads',
//       resource_type: isRaw ? 'raw' : 'auto',
//       allowed_formats: [
//         'jpg', 'jpeg', 'png', 'gif',
//         'pdf', 'doc', 'docx', 'txt',
//         'mp4', 'mp3', 'wav', 'webm', 'ppt','pptx'
//       ],
//       // ✅ **MODIFIED**: public_id no longer includes the file extension
//       public_id: `${Date.now()}-${fileName}`, 
//     };
//   },
// });

// // ✅ Multer middleware for file uploads
// export const upload = multer({
//   storage,
//   limits: {
//     fileSize:10* 10*10*10*10 * 1024 * 1024, 
//   },
// });

// export default cloudinary;
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Dynamic Cloudinary storage config that accepts ANY file type
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const mime = file.mimetype;
    
    // ✅ Expanded list of MIME types that should be treated as 'raw'
    const rawMimeTypes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/rtf',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      // Other formats
      'application/json',
      'application/xml',
      'text/xml',
      'application/octet-stream', // Generic binary
    ];
    
    // ✅ Check if it's a raw type or audio file
    const isRaw = rawMimeTypes.includes(mime) || 
                  mime.startsWith('audio/') || 
                  mime.startsWith('application/');
    
    // ✅ Get clean filename
    const fileName = path.parse(file.originalname).name.replace(/\s+/g, '_');
    
    return {
      folder: 'chat-uploads',
      resource_type: isRaw ? 'raw' : 'auto',
      // ✅ REMOVED allowed_formats to accept ANY file type
      // This is the key fix - removing format restrictions
      public_id: `${Date.now()}-${fileName}`,
    };
  },
});

// ✅ Multer middleware with increased file size limit
export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit (your calculation was incorrect)
  },
  // ✅ Optional: Add file filter for additional control
  fileFilter: (req, file, cb) => {
    // Accept all files - you can add restrictions here if needed
    cb(null, true);
    
    // Example of how to restrict certain file types if needed:
    // const allowedMimes = ['image/', 'application/', 'text/', 'audio/', 'video/'];
    // const isAllowed = allowedMimes.some(type => file.mimetype.startsWith(type));
    // cb(null, isAllowed);
  }
});

export default cloudinary;