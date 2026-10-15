import dynamic from "next/dynamic";

// recharts is heavy and this page is reached only from the admin menu, so
// there's no reason to ship its JS until this route is actually opened.
const AdminStatsPage = dynamic(() =>
  import("@/features/admin/components/admin-stats-page").then((m) => m.AdminStatsPage)
);

export const metadata = { title: "آمار رشد و استفاده | پنل مدیریت جیم‌لیک" };

export default function Page() {
  return <AdminStatsPage />;
}
