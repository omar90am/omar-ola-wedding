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

لوحة الإدارة:
https://omar90am.github.io/omar-ola-wedding/admin.html
```

## معلومات الحفل

- السبت 26 ديسمبر 2026
- قاعة أوريف — عنكاوا، أربيل
- استقبال الضيوف 19:00
- آخر موعد للرد: **22 ديسمبر 2026**
- Firestore يمنع إنشاء أو تعديل RSVP للضيوف عند بداية 23 ديسمبر 2026 بتوقيت العراق، بينما تبقى صلاحيات الإدارة تعمل.

## الأمان

لوحة الإدارة تستخدم Firebase Authentication بالبريد وكلمة المرور، ولا تُفتح بيانات الضيوف إلا للمستخدم الذي يملك مستندًا مطابقًا لـ UID داخل `admins/<UID>`.

Firestore Rules تمنع المستخدم العام من عمل `list/query` لقائمة الضيوف كاملة، وتمنع تعديل حقول الإدارة مثل الطاولة وCheck-in من واجهة الضيف.

## النشر

GitHub Pages:

**Settings → Pages → Deploy from a branch → main → / (root)**

Firebase Rules موجودة في `firestore.rules`.

## الإصدار

هذه النسخة معتمدة على أنها **الإصدار الأول: v1.0.0**. لا توجد إصدارات عامة سابقة في سجل المشروع.
