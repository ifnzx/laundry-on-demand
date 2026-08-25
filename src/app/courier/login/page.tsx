import { redirect } from "next/navigation";

/** Portal kurir digabung ke admin — redirect */
export default function CourierLoginRedirect() {
  redirect("/admin/login");
}
