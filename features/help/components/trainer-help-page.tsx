"use client";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { RoleGate } from "@/features/authentication/components/role-gate";

interface HelpTopic {
  title: string;
  steps: string[];
  href?: string;
  linkLabel?: string;
}

// Plain text on purpose: the site is a static export, so this ships with the
// frontend and needs no endpoint or table. Keep each topic short — an out-of-date
// long guide is worse than none.
const TOPICS: HelpTopic[] = [
  {
    title: "چطور ورزشکار اضافه کنم؟",
    href: "/athletes?new=1",
    linkLabel: "افزودن ورزشکار",
    steps: [
      "از منوی کناری وارد «ورزشکاران» شوید و روی «افزودن ورزشکار جدید» بزنید.",
      "نام و نام خانوادگی را وارد کنید. موبایل، قد و وزن اختیاری هستند.",
      "یک لینک دعوت ساخته می‌شود. آن را از طریق دکمه‌های اشتراک‌گذاری یا کپی برای ورزشکار بفرستید.",
      "ورزشکار با باز کردن لینک و وارد کردن ایمیل و رمز عبور، به پنل خودش وارد می‌شود.",
    ],
  },
  {
    title: "چطور برنامه تمرینی بنویسم؟",
    href: "/workout-programs",
    linkLabel: "برنامه‌های تمرینی",
    steps: [
      "از منوی «برنامه‌ها» وارد «برنامه‌های تمرینی» شوید.",
      "ورزشکار را انتخاب و برنامه جدید را بسازید. می‌توانید حرکت‌ها را با فرم بنویسید یا مستقیم تایپ کنید.",
      "در حالت تایپ مستقیم، زیر کادر یک «راهنمای نوشتن دستی» هست که شکل‌های قابل‌قبول را نشان می‌دهد.",
      "برنامه را ذخیره کنید تا ورزشکار آن را در پنل خودش ببیند.",
    ],
  },
  {
    title: "چطور برنامه غذایی بنویسم؟",
    href: "/nutrition-programs",
    linkLabel: "برنامه‌های غذایی",
    steps: [
      "از منوی «برنامه‌ها» وارد «برنامه‌های غذایی» شوید.",
      "ورزشکار را انتخاب و وعده‌ها را بنویسید. می‌توانید غذاها را از کتابخانه غذاها انتخاب کنید.",
      "برنامه را ذخیره کنید تا برای ورزشکار نمایش داده شود.",
    ],
  },
  {
    title: "قالب چیست و چه کمکی می‌کند؟",
    href: "/templates",
    linkLabel: "قالب‌ها",
    steps: [
      "قالب، یک برنامه آماده است که یک بار می‌نویسید و برای چند ورزشکار استفاده می‌کنید.",
      "از «برنامه‌ها ← قالب‌ها» قالب تمرینی یا غذایی بسازید.",
      "هنگام نوشتن برنامه برای ورزشکار، قالب را انتخاب کنید و فقط تفاوت‌ها را ویرایش کنید.",
    ],
  },
  {
    title: "چطور با ورزشکار در ارتباط باشم؟",
    href: "/messages",
    linkLabel: "پیام‌ها",
    steps: [
      "«پیام‌ها» برای گفتگوی مستقیم با هر ورزشکار درباره برنامه‌هایش است.",
      "«تیکت‌ها» برای درخواست‌های رسمی ورزشکاران است. هر تیکت شماره پیگیری دارد و وضعیتش را می‌توانید تغییر دهید.",
    ],
  },
  {
    title: "پیشرفت ورزشکار را کجا ببینم؟",
    href: "/progress",
    linkLabel: "پیشرفت ورزشکاران",
    steps: [
      "در «پیشرفت ورزشکاران» روند وزن، BMI، درصد چربی، دور کمر و دور سینه هر ورزشکار را در نمودار می‌بینید.",
      "برای نمودار کامل‌تر از ورزشکار بخواهید اندازه‌هایش را مرتب ثبت کند.",
    ],
  },
  {
    title: "پرسشنامه و تقویم چه کاری انجام می‌دهند؟",
    href: "/questionnaires",
    linkLabel: "پرسشنامه‌ها",
    steps: [
      "در «پرسشنامه‌ها» فرم دلخواه می‌سازید، برای ورزشکاران می‌فرستید و پاسخ‌ها را جدولی و خلاصه می‌بینید.",
      "«تقویم» جلسات خصوصی زمان‌بندی‌شده و یادآوری‌های شما را در تقویم شمسی نشان می‌دهد.",
    ],
  },
  {
    title: "درآمد و فاکتورها را چطور مدیریت کنم؟",
    href: "/earnings",
    linkLabel: "درآمد من",
    steps: [
      "در «درآمد من» شهریه‌های دریافتی از شاگردان را ثبت می‌کنید و درآمد ماهانه و روند آن را می‌بینید.",
      "در «فاکتورهای من» فاکتورهای صادرشده و وضعیت پرداخت هرکدام را می‌بینید.",
    ],
  },
  {
    title: "رزومه و امتیاز من چیست؟",
    href: "/trainer-resume",
    linkLabel: "رزومهٔ من",
    steps: [
      "در «رزومهٔ من» بیوگرافی، افتخارات، مدارک، تعرفه و شبکه‌های اجتماعی‌تان را برای شاگردانتان می‌نویسید.",
      "در «امتیاز من» امتیاز و سطح خود را می‌بینید و می‌دانید هر امتیاز برای چه کاری بوده است.",
    ],
  },
  {
    title: "اعلان‌ها را چطور روی گوشی دریافت کنم؟",
    href: "/calendar",
    linkLabel: "تقویم",
    steps: [
      "در صفحهٔ «تقویم»، بالای صفحه کلید فعال‌سازی اعلان گوشی هست.",
      "در آیفون، اعلان فقط برای برنامه‌ای کار می‌کند که روی صفحهٔ اصلی گوشی نصب شده باشد. راهنمای نصب کنار همان کلید است.",
      "در «تنظیمات و پروفایل» می‌توانید انتخاب کنید اعلان‌ها از چه راه‌هایی برسند.",
    ],
  },
];

const QUICK_START = [
  "یک ورزشکار اضافه کنید و لینک دعوت را برایش بفرستید.",
  "برای او برنامه تمرینی و غذایی بنویسید.",
  "از «پیام‌ها» و «پیشرفت ورزشکاران» روند کار را دنبال کنید.",
];

export function TrainerHelpPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">راهنمای استفاده</h1>
          <p className="text-sm text-muted-foreground">
            پاسخ کوتاه به سؤال‌های رایج مربیان در جیم‌لیک.
          </p>
        </div>

        <Card className="space-y-3 p-5">
          <h2 className="text-base font-semibold text-foreground">شروع سریع</h2>
          <ol className="list-inside list-decimal space-y-1.5 text-sm leading-7 text-muted-foreground">
            {QUICK_START.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>

        <div className="space-y-3">
          {TOPICS.map((topic) => (
            <CollapsibleSection key={topic.title} title={topic.title}>
              <ol className="list-inside list-decimal space-y-1.5 text-sm leading-7 text-muted-foreground">
                {topic.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {topic.href && topic.linkLabel && (
                <Link
                  href={topic.href}
                  className="inline-block text-sm font-medium text-primary hover:underline"
                >
                  رفتن به «{topic.linkLabel}»
                </Link>
              )}
            </CollapsibleSection>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          جواب سؤالتان را پیدا نکردید؟ اگر دکمهٔ پشتیبانی بالای صفحه نمایش داده می‌شود، از آن با ما تماس بگیرید.
        </p>
      </div>
    </RoleGate>
  );
}
