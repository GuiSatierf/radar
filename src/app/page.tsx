import { redirect } from "next/navigation";
import { HOME_PATH } from "@/config/navigation";

export default function HomePage(): never {
  redirect(HOME_PATH);
}
