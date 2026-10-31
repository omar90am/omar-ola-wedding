# Omar & Ola Wedding — v1.0.0

الإصدار الأول الرسمي لموقع دعوة زفاف عمر وعلا، جاهز للنشر على GitHub Pages ومربوط بمشروع Firebase `omar-ola-wedding`.

## الموقع النهائي

بعد اعتماد اسم المستودع `omar-ola-wedding`:

```text
الرابط الرئيسي:
https://omar90am.github.io/omar-ola-wedding/

دعوة جهة عمر:
https://omar90am.github.io/omar-ola-wedding/?from=groom

دعوة جهة علا:
https://omar90am.github.io/omar-ola-wedding/?from=bride

الفوون بوث — رابط الضيوف:
https://omar90am.github.io/omar-ola-wedding/phonebooth/

لوحة الإدارة:
https://omar90am.github.io/omar-ola-wedding/admin.html
```

## الفوون بوث الرقمي

تمت إضافة **Ola & Omar Phonebooth** كدفتر ذكريات رقمي للزفاف، بواجهة عربية كاملة واتجاه RTL وبنفس الهوية البصرية للموقع والدعوة.

يستطيع الضيف فتح رابط الفوون بوث مباشرة من الهاتف وترك إحدى الذكريات التالية:

- تسجيل رسالة صوتية حتى 3 دقائق.
- كتابة رسالة أو أمنية للعروسين.
- مشاركة صورة مع تعليق اختياري.
- كتابة اسم الضيف بشكل اختياري.

تُحفظ بيانات الذكريات في مجموعة `phoneboothMemories` في Firebase Firestore، مع استخدام Firebase Anonymous Authentication لجلسة الضيف. الصور والتسجيلات الصوتية تُرفع إلى Cloudinary باستخدام upload preset مخصص للمشروع، بينما تُحفظ بياناتها ورابطها مع سجل الذكرى في Firestore.

رابط الفوون بوث المخصص للمشاركة مع الضيوف:

```text
https://omar90am.github.io/omar-ola-wedding/phonebooth/
```

## معلومات الحفل

- السبت 26 ديسمبر 2026
- قاعة أوريف — عنكاوا، أربيل
- استقبال الضيوف 19:00
- آخر موعد للرد: **22 ديسمبر 2026**
- Firestore يمنع إنشاء أو تعديل RSVP للضيوف عند بداية 23 ديسمبر 2026 بتوقيت العراق، بينما تبقى صلاحيات الإدارة تعمل.

## الأمان

لوحة الإدارة تستخدم Firebase Authentication بالبريد وكلمة المرور، ولا تُفتح بيانات الضيوف إلا للمستخدم الذي يملك مستندًا مطابقًا لـ UID داخل `admins/<UID>`.

Firestore Rules تمنع المستخدم العام من عمل `list/query` لقائمة الضيوف كاملة، وتمنع تعديل حقول الإدارة مثل الطاولة وCheck-in من واجهة الضيف. ذكريات الفوون بوث تُنشأ من جلسة الضيف، بينما القراءة والتعديل والحذف محصورة بصلاحيات الإدارة حسب قواعد Firestore.

## بنية المشروع

- `index.html` / `index-base.html` — موقع الدعوة الرئيسي.
- `admin.html` — لوحة الإدارة.
- `phonebooth/index.html` — واجهة الفوون بوث العربية للضيوف.
- `phonebooth/phonebooth.css` — تصميم الفوون بوث المتوافق مع ثيم الدعوة.
- `phonebooth/phonebooth.js` — التسجيل الصوتي، الصور، الرسائل، Firebase وCloudinary.
- `firestore.rules` — قواعد Firestore للـ RSVP وذكريات الفوون بوث.

## النشر

GitHub Pages:

**Settings → Pages → Deploy from a branch → main → / (root)**

Firebase Rules موجودة في `firestore.rules`.

## الإصدار

هذه النسخة معتمدة على أنها **الإصدار الأول: v1.0.0**. لا توجد إصدارات عامة سابقة في سجل المشروع.
