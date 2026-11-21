const enc = encodeURIComponent;

/**
 * Every URL of RateLama in one place. Public URLs (join, play, /q, invitation, presentation) appear in QR codes,
 * invitations and shared links and must stay stable.
 */
export const routes = {
  home: "/",
  join: (joinCode?: string) => joinCode ? `/join/${enc(joinCode)}` : "/join",
  play: (sessionId: string) => `/play/${enc(sessionId)}`,
  asyncQuiz: (token: string) => `/q/${enc(token)}`,
  invitation: (code: string) => `/einladung/${enc(code)}`,
  presentation: (presentationToken: string) => `/present/${enc(presentationToken)}`,
  admin: "/admin",
  newQuiz: "/admin/quizzes/new",
  generate: "/admin/quizzes/generate",
  quiz: (quizId: string) => `/admin/quizzes/${enc(quizId)}`,
  editQuiz: (quizId: string) => `/admin/quizzes/${enc(quizId)}/bearbeiten`,
  publish: (quizId: string) => `/admin/quizzes/${enc(quizId)}/publish`,
  asyncResults: (publicationId: string) => `/admin/async/${enc(publicationId)}`,
  session: (sessionId: string) => `/admin/sessions/${enc(sessionId)}`,
  impressum: "/impressum",
  privacy: "/datenschutz",
} as const;
