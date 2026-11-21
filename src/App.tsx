import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminGate } from "./ui/admin/AdminGate";
import { DashboardPage } from "./ui/admin/DashboardPage";
import { DraftStorageContext } from "./ui/admin/draftStorage";
import { GeneratorPage } from "./ui/admin/GeneratorPage";
import { LocalDashboardPage } from "./ui/admin/LocalDashboardPage";
import { QuizDetailPage } from "./ui/admin/QuizDetailPage";
import { QuizEditorPage } from "./ui/admin/QuizEditorPage";
import { AsyncPlayerPage } from "./ui/async/AsyncPlayerPage";
import { AsyncResultsPage } from "./ui/async/AsyncResultsPage";
import { InvitationPage } from "./ui/async/InvitationPage";
import { PublishPage } from "./ui/async/PublishPage";
import { HomePage } from "./ui/home/HomePage";
import { Datenschutz, Impressum } from "./ui/home/LegalRoutes";
import { NotFoundPage, UnavailablePage } from "./ui/home/StatusPages";
import { HostSessionPage } from "./ui/live/HostSessionPage";
import { LivePlayerPage } from "./ui/live/LivePlayerPage";
import { PresentationPage } from "./ui/live/PresentationPage";
import { AdminLayout } from "./ui/shell/AdminLayout";
import { AppModeContext } from "./ui/shell/appMode";

/** Quizmaster area: in cloud mode behind the Cognito login, always with the sidebar layout. */
function AdminArea({ cloud }: { cloud: boolean }) {
  const area = <AdminLayout><Outlet /></AdminLayout>;
  return cloud ? <AdminGate>{area}</AdminGate> : area;
}

/** After every route change: back to the top and focus on the main content (screen readers, keyboard). */
function useRouteFocus() {
  const { pathname } = useLocation();
  const previousRef = useRef(pathname);
  useEffect(() => {
    if (previousRef.current === pathname) return;
    previousRef.current = pathname;
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
}

export function App({ cloudConfigured = false }: { cloudConfigured?: boolean }) {
  const cloud = cloudConfigured;
  const [draftStorageEnabled, setDraftStorageEnabled] = useState(false);
  const draftStorage = useMemo(() => ({ enabled: draftStorageEnabled, setEnabled: setDraftStorageEnabled }), [draftStorageEnabled]);
  const mode = useMemo(() => ({ cloud }), [cloud]);
  useRouteFocus();
  return <AppModeContext.Provider value={mode}>
    <DraftStorageContext.Provider value={draftStorage}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join" element={cloud ? <HomePage /> : <UnavailablePage />} />
        <Route path="/join/:joinCode" element={cloud ? <HomePage /> : <UnavailablePage />} />
        <Route path="/play/:sessionId" element={cloud ? <LivePlayerPage /> : <UnavailablePage />} />
        <Route path="/present/:presentationToken" element={cloud ? <PresentationPage /> : <UnavailablePage />} />
        <Route path="/q/:token" element={cloud ? <AsyncPlayerPage /> : <UnavailablePage kind="async" />} />
        <Route path="/einladung/:code" element={cloud ? <InvitationPage /> : <UnavailablePage kind="async" />} />
        <Route path="/admin" element={<AdminArea cloud={cloud} />}>
          <Route index element={cloud ? <DashboardPage /> : <LocalDashboardPage />} />
          <Route path="quizzes/new" element={<QuizEditorPage />} />
          <Route path="quizzes/generate" element={cloud ? <GeneratorPage /> : <UnavailablePage kind="generator" />} />
          <Route path="quizzes/:quizId" element={<QuizDetailPage />} />
          <Route path="quizzes/:quizId/bearbeiten" element={<QuizEditorPage />} />
          <Route path="quizzes/:quizId/publish" element={cloud ? <PublishPage /> : <UnavailablePage kind="async" />} />
          <Route path="async/:publicationId" element={cloud ? <AsyncResultsPage /> : <UnavailablePage kind="async" />} />
          <Route path="sessions/:sessionId" element={cloud ? <HostSessionPage /> : <UnavailablePage />} />
        </Route>
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="/neu/uebersicht" element={<Navigate to="/admin" replace />} />
        <Route path="/neu/quizze/*" element={<Navigate to="/admin" replace />} />
        <Route path="/neu/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </DraftStorageContext.Provider>
  </AppModeContext.Provider>;
}
