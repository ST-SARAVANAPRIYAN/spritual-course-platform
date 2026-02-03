const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

// Configure Cloudflare R2 Client
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY,
    }
});

// Configure Multer to use S3/R2
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.R2_BUCKET_NAME,
        acl: 'public-read', // Note: R2 might not support ACLs the same way, usually handled by bucket public access
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            // Unique filename: fieldname-timestamp-random.ext
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // Limit to 50MB (adjust as needed for videos)
    fileFilter: (req, file, cb) => {
        // Allow images, videos, audio, pdf
        const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|mp3|wav|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: File type not supported!'));
    }
});

module.exports = upload;
