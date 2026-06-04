import { redirect } from "next/navigation";

/**
 * /v2 root → redirect to Today
 */
export default function V2Root() {
  redirect("/v2/today");
}
