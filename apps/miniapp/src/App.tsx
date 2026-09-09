import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import BottomNav from "./components/BottomNav";
import LegalFooter from "./components/LegalFooter";
import { screen, startAnalyticsFlush } from "./lib/analytics";
import { bootstrapCatalog, useCatalog } from "./lib/catalog";
import Home from "./routes/Home";
import Search from "./routes/Search";
import Drink from "./routes/Drink";
import Food from "./routes/Food";
import Browse from "./routes/Browse";
import Restaurants from "./routes/Restaurants";
import Related from "./routes/Related";
import Saved from "./routes/Saved";
import My from "./routes/My";
import NotFound from "./routes/NotFound";

/** 화면 전환 시 스크롤 상단 + 화면 로그 */
function RouteEffects() {
  const { pathname, search } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); screen(pathname + search); }, [pathname, search]);
  return null;
}

export default function App() {
  const { version } = useCatalog();
  useEffect(() => { void bootstrapCatalog(); startAnalyticsFlush(); }, []);
  return (
    <BrowserRouter>
      <RouteEffects />
      <div className="mx-auto max-w-[430px] min-h-dvh bg-bg flex flex-col border-x border-line pb-24">
        {/* 카탈로그가 갈아끼워지면 화면을 다시 그린다 (모듈 인덱스는 이미 갱신됨) */}
        <Routes key={version}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/drink/:id" element={<Drink />} />
          <Route path="/food/:id" element={<Food />} />
          <Route path="/browse/:kind/:key" element={<Browse />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/related" element={<Related />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/my" element={<My />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <LegalFooter />
      </div>
      <BottomNav />
    </BrowserRouter>
  );
}
