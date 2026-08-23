import { redirect } from "next/navigation";

/** /docs 默认进入「简介」章节 */
export default function DocsIndex() {
  redirect("/docs/intro");
}
