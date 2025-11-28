import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAPK } from '../apk-generator/builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// تخزين الملفات المؤقتة
const TEMP_DIR = path.join(__dirname, '../temp');
const APK_DIR = path.join(__dirname, '../generated-apks');

// تأكد من وجود المجلدات
fs.ensureDirSync(TEMP_DIR);
fs.ensureDirSync(APK_DIR);

// مسار لإنشاء APK
router.post('/generate-apk', async (req, res) => {
    try {
        const { websiteUrl, appName } = req.body;

        // التحقق من المدخلات
        if (!websiteUrl) {
            return res.status(400).json({ 
                success: false,
                error: 'رابط الموقع مطلوب' 
            });
        }

        // التحقق من صحة الرابط
        try {
            new URL(websiteUrl);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'رابط غير صحيح'
            });
        }

        console.log(`📱 طلب جديد: ${websiteUrl} - ${appName || 'اسم افتراضي'}`);

        // إنشاء التطبيق
        const apkData = await generateAPK(websiteUrl, appName);

        res.json({
            success: true,
            downloadUrl: `/api/download/${apkData.filename}`,
            filename: apkData.filename,
            message: 'تم إنشاء التطبيق بنجاح'
        });

    } catch (error) {
        console.error('❌ Error generating APK:', error);
        res.status(500).json({ 
            success: false,
            error: 'فشل في إنشاء التطبيق: ' + error.message 
        });
    }
});

// مسار لتحميل الملف
router.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(APK_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'الملف غير موجود' });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                res.status(500).json({ error: 'خطأ في التحميل' });
            }
            
            // حذف الملف بعد دقيقة من التحميل (اختياري)
            setTimeout(() => {
                fs.remove(filePath).catch(console.error);
            }, 60000);
        });

    } catch (error) {
        console.error('❌ Download route error:', error);
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// مسار لحالة السيرفر
router.get('/status', (req, res) => {
    res.json({ 
        status: 'running',
        service: 'Web to APK Converter',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// مسار لتنظيف الملفات القديمة
router.get('/cleanup', async (req, res) => {
    try {
        const files = await fs.readdir(APK_DIR);
        const now = Date.now();
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(APK_DIR, file);
            const stats = await fs.stat(filePath);
            const fileAge = now - stats.mtimeMs;

            // حذف الملفات الأقدم من ساعة
            if (fileAge > 3600000) {
                await fs.remove(filePath);
                deletedCount++;
            }
        }

        res.json({
            success: true,
            message: `تم حذف ${deletedCount} ملف`,
            deletedCount
        });

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        res.status(500).json({ error: 'خطأ في التنظيف' });
    }
});

export default router;
