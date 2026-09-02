# جیم‌لیک (Gymlic)

پلتفرم SaaS مدیریت باشگاه، مربی و ورزشکار — Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase.

## راه‌اندازی

1. یک پروژه در [Supabase](https://supabase.com) بسازید.
2. فایل‌های SQL داخل `supabase/migrations` را به ترتیب (`0001_init.sql` سپس `0002_dashboard_metrics.sql`) در SQL Editor پروژه اجرا کنید.
3. در تنظیمات Authentication پروژه، ورود با شماره موبایل (Phone / OTP) را فعال کنید و یک SMS Provider متصل کنید.
4. فایل `.env.example` را کپی کرده و به `.env.local` تغییر نام دهید، سپس مقادیر را از Project Settings → API پر کنید:

   ```bash
   cp .env.example .env.local
   ```

5. نصب و اجرا:

   ```bash
   npm install
   npm run dev
   ```

   سپس آدرس [http://localhost:3000](http://localhost:3000) را باز کنید.

## استقرار (Vercel)

- متغیرهای `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` را در Settings → Environment Variables برای هر سه محیط Production / Preview / Development تعریف کنید. این متغیرها در Middleware خوانده می‌شوند و اگر تعریف نشوند، کاربر روی تمام مسیرهای محافظت‌شده به `/login` هدایت می‌شود (خطای مربوطه در Runtime Logs ثبت می‌شود).
- پس از تغییر مقادیر، یک Redeploy لازم است تا متغیرهای جدید اعمال شوند.

## معماری

- `app/` — مسیرهای Next.js App Router؛ گروه `(auth)` صفحات ورود/OTP/انتخاب نقش و گروه `(dashboard)` پنل اصلی را در بر می‌گیرد.
- `features/authentication/` — فلوی کامل احراز هویت (OTP، انتخاب نقش، ساخت باشگاه، تایید دعوت) طبق ساختار Component → Hook → Service → Supabase.
- `features/dashboard/` — سه نوع داشبورد (باشگاه، مربی، ورزشکار)، هرکدام Widget-Based با Loading / Empty / Error State مستقل.
- `features/members/` — مدیریت اعضای باشگاه (دعوت عضو جدید، ویرایش طرح و وضعیت، تعلیق، حذف، جستجو و فیلتر).
- `features/trainers/` — مدیریت مربیان باشگاه (دعوت مربی، تعلیق، حذف، شمارش شاگردان هر مربی).
- `features/revenue/` — دفتر درآمد باشگاه (ثبت شهریه و دریافتی‌ها، ویرایش و حذف، خلاصه و نمودار ماهانه).
- `features/club/` — تنظیمات باشگاه (نام، لوگو، آدرس، تلفن، ساعات کاری) و طرح‌های عضویت اختصاصی هر باشگاه.
- `components/layout/` — Header و Sidebar پویا بر اساس نقش کاربر (اعضای مشترک بین تمام صفحات پنل).
- `components/ui/` — کامپوننت‌های پایه به سبک shadcn/ui.
- `lib/supabase/` — کلاینت‌های Supabase برای مرورگر، Server Component و Middleware.
- `supabase/migrations/` — اسکیمای کامل دیتابیس، شامل Row Level Security چندمستأجری (هر جدول بر اساس باشگاه یا رابطه مربی/ورزشکار محدود می‌شود).

## نکات مهم

- تمام داده‌های داشبورد از Supabase خوانده می‌شوند؛ داده Mock وجود ندارد. برای دیدن اطلاعات واقعی، پس از اجرای migrationها چند رکورد نمونه (عضو، مربی، تراکنش درآمد، حضور کلاس) در جداول مربوطه ثبت کنید.
- جهت و زبان پیش‌فرض کل برنامه RTL و فارسی است.
- فونت مورد استفاده Vazirmatn (از طریق `next/font/google`) است.
