// =============================================
// App.tsx - ルーティング設定
// =============================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ElectionProvider } from './contexts/ElectionContext';
import VotePage from './pages/VotePage';
import SignagePage from './pages/SignagePage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* メイン投票画面（QRから飛ぶ先） */}
        <Route
          path="/"
          element={
            <ElectionProvider>
              <VotePage />
            </ElectionProvider>
          }
        />

        {/* サイネージ表示用 */}
        <Route path="/signage" element={<SignagePage />} />

        {/* 管理者画面 */}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
