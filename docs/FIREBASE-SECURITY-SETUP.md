# Firebase security setup

تم إعداد المشروع ليستخدم:

1. Firebase Authentication عبر Email/Password.
2. مستند `admins/<UID>` لاعتماد حساب الإدارة.
3. `firestore.rules` لمنع تعداد قائمة الضيوف وحماية حقول الإدارة.
4. إغلاق RSVP العام عند **23 ديسمبر 2026 الساعة 00:00 بتوقيت العراق**؛ أي أن آخر يوم كامل للرد هو 22 ديسمبر.

عند إنشاء مدير جديد: أنشئ المستخدم في Authentication، انسخ UID، ثم أنشئ Document بنفس UID داخل Collection اسمها `admins`.
