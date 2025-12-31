<?php
/**
 * API لإدارة الفروع
 */
require_once 'config.php';

$method = getRequestMethod();
$data = getRequestData();

// قراءة جميع الفروع
if ($method === 'GET') {
    try {
        $session = checkAuth();
        
        // التحقق من وجود معامل include_with_expenses
        $includeWithExpenses = isset($_GET['include_with_expenses']) && $_GET['include_with_expenses'] === 'true';
        
        if ($includeWithExpenses) {
            // جلب جميع الفروع النشطة + الفروع التي لديها مصاريف مرتبطة بها (حتى لو كانت غير نشطة)
            $branches = dbSelect("
                SELECT DISTINCT b.id, b.name, b.code, b.has_pos, b.is_active, b.created_at 
                FROM branches b
                WHERE b.is_active = 1 
                   OR EXISTS (
                       SELECT 1 FROM expenses e 
                       WHERE e.branch_id = b.id
                   )
                ORDER BY b.is_active DESC, b.name ASC
            ");
        } else {
            // جلب جميع الفروع (لصفحة الإعدادات والمستخدمين) - حتى غير النشطة
            $branches = dbSelect("SELECT id, name, code, has_pos, is_active, created_at FROM branches ORDER BY created_at ASC, id ASC");
            
            // إذا فشل الاستعلام، محاولة جلب الفروع بدون فلترة
            if ($branches === false) {
                error_log('⚠️ فشل الاستعلام الأول، محاولة استعلام بديل...');
                $branches = dbSelect("SELECT * FROM branches ORDER BY created_at ASC, id ASC");
            }
            
            // إذا فشل مرة أخرى، محاولة استعلام بسيط
            if ($branches === false) {
                error_log('⚠️ فشل الاستعلام الثاني، محاولة استعلام بسيط...');
                $branches = dbSelect("SELECT id, name FROM branches ORDER BY name ASC");
            }
        }
        
        // التحقق من النتيجة
        if ($branches === false) {
            error_log('❌ فشل جلب الفروع من قاعدة البيانات بعد جميع المحاولات');
            // إرجاع مصفوفة فارغة بدلاً من false لتجنب الأخطاء
            $branches = [];
        }
        
        // التأكد من أن $branches هي array
        if (!is_array($branches)) {
            error_log('⚠️ $branches ليست مصفوفة، تحويل إلى مصفوفة فارغة');
            $branches = [];
        }
        
        // تسجيل عدد الفروع للتحقق
        $branchesCount = count($branches);
        error_log('✅ تم جلب ' . $branchesCount . ' فرع من قاعدة البيانات');
        
        // تسجيل تفاصيل الفروع للتحقق
        if ($branchesCount > 0) {
            foreach ($branches as $index => $branch) {
                error_log('  - فرع ' . ($index + 1) . ': ' . ($branch['name'] ?? 'بدون اسم') . ' (ID: ' . ($branch['id'] ?? 'بدون ID') . ')');
            }
        } else {
            error_log('⚠️ لا توجد فروع في قاعدة البيانات');
        }
        
        response(true, '', $branches);
    } catch (Exception $e) {
        error_log('❌ خطأ في branches.php: ' . $e->getMessage());
        response(false, 'خطأ في قراءة الفروع: ' . $e->getMessage(), null, 500);
    } catch (Error $e) {
        error_log('❌ خطأ قاتل في branches.php: ' . $e->getMessage());
        response(false, 'خطأ في قراءة الفروع: ' . $e->getMessage(), null, 500);
    }
}

response(false, 'طريقة غير مدعومة', null, 405);
?>

