import { Link } from "react-router";
import SearchBox from "@/components/SearchBox";

export default function NotFound() {
  return (
    <main className="px-5 pt-10 text-center">
      <div className="text-[17px] font-bold">찾을 수 없는 페이지예요</div>
      <p className="text-[13px] text-muted mt-2">술이나 음식을 검색해 보세요.</p>
      <div className="mt-4 text-left"><SearchBox /></div>
      <Link to="/" className="btn btn-ghost mt-4">홈으로</Link>
    </main>
  );
}
