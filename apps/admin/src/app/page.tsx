import { redirect } from "next/navigation";

/** `/login` (via AdminRouteGuard) itself forwards an already-authenticated admin to `/dashboard`. */
export default function AdminRootPage() {
  redirect("/login");
}
