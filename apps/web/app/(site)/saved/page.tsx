import { permanentRedirect } from "next/navigation";
/** 예전 경로 — 마이페이지로 합쳤다 */
export default function SavedRedirect() { permanentRedirect("/my"); }
