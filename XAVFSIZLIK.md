# Xavfsizlik: frontend holati va backend uchun vazifalar

Hozircha backend yo'q, barcha ma'lumotlar brauzerdagi `localStorage` da saqlanadi.
Frontenddagi himoya oddiy foydalanuvchini to'xtatadi, lekin brauzer konsolini biladigan
odamni to'liq to'xtata olmaydi. Haqiqiy himoya backend ulangandan keyin bo'ladi.

## Frontendda qilingan ishlar

| O'zgarish | Fayl |
|---|---|
| Super Admin paroli PBKDF2 bilan xeshlanadi, ochiq saqlanmaydi. Eski ochiq parol birinchi kirishda xeshga o'tkaziladi | `src/super-admin/tenantStorage.js` |
| Kirish oynasida parol avtomatik to'ldirilmaydi | `src/super-admin/SuperAdminLogin.jsx` |
| Super Admin sessiyasi `"1"` emas, hisob salt'iga bog'langan. Parol almashsa, eski sessiya bekor bo'ladi | `tenantStorage.js`, `App.jsx` |
| Har noto'g'ri urinishdan keyin kirish tugmasi bloklanadi va ustida qolgan vaqt ko'rinadi: 5s, 10s, 30s, 1 daq, 5 daq, 10 daq, 30 daq, 1 soat, keyin har safar 2 baravar (24 soatgacha). Direktor, xodim va Super Admin uchun. Blok shu qurilmadagi kirish oynasiga qo'yiladi (boshqa login yozib aylanib o'tib bo'lmaydi), to'g'ri kirishda nolga tushadi | `src/data/loginThrottle.js`, `Login.jsx`, `SuperAdminLogin.jsx` |
| Taklif havolasi endi faqat birinchi direktorni yaratadi, mavjud direktor parolini almashtira olmaydi (`resetDirectorFromInvite` o'chirildi) | `TenantWelcome.jsx`, `accessStore.js` |
| Parol tiklash demo kodi (`123456`) faqat dev rejimda va `.env.local` da `REACT_APP_DEMO_RECOVERY=true` bo'lsa ishlaydi | `src/data/passwordRecovery.js` |
| 30 daqiqa harakatsizlikdan keyin avtomatik chiqish | `src/App.jsx` |
| Hisobotni chop etishda HTML ekranlanadi (XSS'ga qarshi) | `src/pages/Reports.jsx` |
| Content-Security-Policy va Referrer-Policy qo'shildi | `public/index.html` |
| `.env` va `.test-temp/` gitga tushmaydi | `.gitignore` |

## Backend uchun vazifalar (muhimlik tartibida)

1. **Autentifikatsiya serverda.** Login va parol serverda tekshiriladi (argon2 yoki bcrypt). Sessiya `HttpOnly; Secure; SameSite=Strict` cookie'da saqlanadi. Frontenddagi `authenticate`, `registerDirector`, `loginAdmin` va `createAdminAccount` API chaqiruviga almashtiriladi.
2. **Ruxsatlar serverda.** Har bir API so'rovida foydalanuvchi roli va `permissions` tekshiriladi. Frontenddagi `canAccess` faqat menyuni yashirish uchun qoladi.
3. **Tenant ajratish.** Har bir yozuv `tenant_id` bilan saqlanadi va sessiyadagi tenant bilan solishtiriladi. Hozirgi `localStorage` prefiksi bilan ajratish himoya emas.
4. **Taklif havolasi.** Bir martalik, 24–48 soat amal qiladigan token. Ishlatilgandan keyin bekor qilinadi.
5. **Parol tiklash.** Haqiqiy SMS yoki email kodi yuboriladi, urinishlar serverda cheklanadi. Ekranlar `passwordRecovery.js` dagi funksiyalar orqali ulanadi: `startRecovery`, `verifyRecoveryCode` va boshqalar.
6. **Login cheklovi serverda.** IP va hisob bo'yicha cheklanadi. Super Admin uchun 2FA qo'shiladi.
7. **HTTP sarlavhalar.** `index.html` dagi CSP sarlavha sifatida yuboriladi, unga `frame-ancestors 'none'` qo'shiladi. HSTS, `X-Content-Type-Options: nosniff` va HTTPS majburiy.
8. **Super Admin.** Hozir saytni birinchi ochgan odam Super Admin hisobini yarata oladi. Backendda bu hisob oldindan yaratilishi kerak.
9. **Zaxira nusxa.** Ma'lumotlar bazasidan kunlik zaxira olinadi.
10. **`xlsx` paketi.** `0.18.5` versiyasida ma'lum zaifliklar bor (CVE-2023-30533, CVE-2024-22363). Kod faqat eksport qiladi, shuning uchun xavf past. Baribir SheetJS'ning `cdn.sheetjs.com` dagi yangi versiyasiga o'tish kerak.

## Super Admin sozlamalari (frontend)

- Profil, login/parol almashtirish (joriy parol bilan, xato urinishlarda bloklanadi), oxirgi kirish tarixi, faolsizlikda avtomatik chiqish (10–60 daqiqa).
- **Zaxira nusxa fayli** barcha mijozlarning CRM ma'lumotlarini ochiq holda saqlaydi (login/parol xeshi kirmaydi). Uni maxfiy hujjat sifatida saqlash kerak.
- Tiklashda fayl ishonchsiz ma'lumot deb tekshiriladi: faqat `tenant:` kalitlari va kutilgan tuzilma qabul qilinadi, Super Admin hisobi fayldan o'zgarmaydi.
- Backend ulanganda zaxira serverda (shifrlangan) olinishi va tiklash audit jurnaliga yozilishi kerak.

## Mijozlarning jonli holati (Super Admin: Control Center, Live Monitoring)

- Fayl: `src/super-admin/tenantPresence.js`. Mijoz CRM'i ochiq va kirilgan bo'lsa har 30 soniyada signal yuboradi; 2,5 daqiqa signal bo'lmasa "Offline". Kirish vaqti, kim kirgani va brauzerdagi JavaScript xatoliklari ham yoziladi.
- **Hozir faqat bitta brauzer ichida ishlaydi** (localStorage). Boshqa kompyuterlardagi mijozlarni ko'rish uchun backend kerak.
- Backend uchun: shu fayldagi `reportLogin`, `reportHeartbeat`, `reportOffline`, `reportError` → API'ga POST; `readPresence` / `useLivePresence` → GET yoki WebSocket; `resolveTenantErrors` → PATCH. Ekranlar o'zgarmaydi.
- Xatolik matnlari 300 belgigacha qisqartiriladi; ularda shaxsiy ma'lumot bo'lishi mumkin, serverda faqat Super Admin ko'rishi kerak.
