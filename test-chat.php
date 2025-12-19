<?php
/**
 * ملف اختبار للتحقق من عمل PHP
 */
echo "PHP يعمل بشكل صحيح!<br>";
echo "المسار الحالي: " . __DIR__ . "<br>";
echo "ملف chat.php موجود: " . (file_exists(__DIR__ . '/chat.php') ? 'نعم' : 'لا') . "<br>";
echo "ملف api/database.php موجود: " . (file_exists(__DIR__ . '/api/database.php') ? 'نعم' : 'لا') . "<br>";
echo "ملف api/chat/auth_helper.php موجود: " . (file_exists(__DIR__ . '/api/chat/auth_helper.php') ? 'نعم' : 'لا') . "<br>";
echo "ملف includes/chat.php موجود: " . (file_exists(__DIR__ . '/includes/chat.php') ? 'نعم' : 'لا') . "<br>";
phpinfo();
?>
