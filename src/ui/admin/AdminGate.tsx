import { useEffect, useState, type ReactNode } from "react";
import { Amplify } from "aws-amplify";
import {
  confirmSignIn, confirmSignUp, fetchAuthSession, getCurrentUser, resendSignUpCode, signIn, signOut, signUp,
} from "aws-amplify/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleAlert, KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";
import { adminAccess, authMessage, emailSchema, passwordSchema } from "../../domain/adminAuth";
import { ErrorNotice, LoadingNotice } from "../common/Notices";
import { ScreenLayout } from "../shell/ScreenLayout";
import { Sparkle } from "../Illustrations";
import { RateLamaMascot } from "../RateLamaMascot";
import { usePageTitle } from "../usePageTitle";
import "../quizzes.css";
import "./admin.css";

type Step = "checking" | "signIn" | "signUp" | "confirm" | "newPassword" | "pending" | "authorized" | "sessionError";
type Fields = { email: string; password: string; code: string };

const TITLES: Record<Step, string> = {
  checking: "Quizmaster-Anmeldung", signIn: "Quizmaster-Anmeldung", signUp: "Quizmaster-Konto anlegen",
  confirm: "E-Mail-Adresse bestätigen", newPassword: "Neues Passwort setzen", pending: "Freigabe ausstehend",
  authorized: "Quizmaster-Anmeldung", sessionError: "Anmeldung prüfen",
};

function GateScreen({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title);
  return <ScreenLayout><div className="rl-adm-login">{children}</div></ScreenLayout>;
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="rl-field-error" role="alert"><CircleAlert aria-hidden="true" /> {text}</p> : null;
}

/** Cognito sign-in for quizmasters; only members of the "Quizmasters" group get through to the admin area. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const newPassword = passwordSchema(Amplify.getConfig().Auth?.Cognito?.passwordFormat);
  const schema = z.object({
    email: emailSchema,
    password: step === "signUp" || step === "newPassword" ? newPassword :
      step === "signIn" ? z.string().min(1, "Bitte das Passwort eingeben.").max(256, "Das Passwort ist zu lang.") : z.string(),
    code: step === "confirm" ? z.string().trim().regex(/^[0-9]{6}$/, "Bitte den sechsstelligen Bestätigungscode eingeben.") : z.string(),
  });
  const { register, handleSubmit, resetField, clearErrors, getValues, trigger, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema), defaultValues: { email: "", password: "", code: "" },
  });

  async function access(forceRefresh = false) {
    const session = await fetchAuthSession({ forceRefresh });
    const next = adminAccess(session.tokens?.idToken?.payload);
    setStep(next === "signedOut" ? "signIn" : next);
  }
  useEffect(() => {
    let active = true;
    // Without a signed-in user no session is requested: fetchAuthSession would otherwise create an anonymous guest identity.
    getCurrentUser().then(() => fetchAuthSession(), () => null).then((session) => {
      if (!active) return;
      if (!session) { setStep("signIn"); return; }
      const next = adminAccess(session.tokens?.idToken?.payload);
      setStep(next === "signedOut" ? "signIn" : next);
    }).catch((caught: unknown) => {
      if (active) { setError(authMessage(caught)); setStep("sessionError"); }
    });
    return () => { active = false; };
  }, []);

  function changeStep(next: Step) {
    setStep(next); setError(""); setNotice(""); clearErrors(); resetField("password"); resetField("code");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (caught) { setError(authMessage(caught)); } finally { setBusy(false); }
  }
  async function signedIn(result: Awaited<ReturnType<typeof signIn>>) {
    if (result.isSignedIn) {
      try { await access(); } catch (caught) { setStep("sessionError"); throw caught; }
    }
    else if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") setStep("newPassword");
    else if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
      setStep("confirm"); setNotice("Bitte bestätige zuerst deine E-Mail-Adresse. Bei Bedarf kannst du einen neuen Code anfordern.");
    } else throw new Error("Nicht unterstützter Anmeldeschritt.");
  }
  async function submit(values: Fields) {
    await run(async () => {
      if (step === "signUp") {
        const result = await signUp({ username: values.email, password: values.password,
          options: { userAttributes: { email: values.email } } });
        if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
          setStep("confirm"); setNotice("Ein Bestätigungscode wurde an deine E-Mail-Adresse gesendet.");
        } else if (result.nextStep.signUpStep === "DONE") {
          setStep("signIn"); setNotice("Dein Konto wurde angelegt. Bitte melde dich an.");
        } else throw new Error("Nicht unterstützter Registrierungsschritt.");
      } else if (step === "confirm") {
        const result = await confirmSignUp({ username: values.email, confirmationCode: values.code });
        if (result.nextStep.signUpStep !== "DONE") throw new Error("Die Bestätigung konnte nicht abgeschlossen werden.");
        setStep("signIn"); setNotice("Deine E-Mail-Adresse ist bestätigt. Bitte melde dich an; die Quizmaster-Freigabe erfolgt anschließend durch die Administration.");
        resetField("code");
      } else if (step === "newPassword") {
        await signedIn(await confirmSignIn({ challengeResponse: values.password }));
      } else {
        try {
          await signedIn(await signIn({ username: values.email, password: values.password }));
        } catch (caught) {
          if (caught instanceof Error && caught.name === "UserNotConfirmedException") {
            setStep("confirm"); setNotice("Bitte bestätige zuerst deine E-Mail-Adresse oder fordere einen neuen Code an.");
          } else throw caught;
        }
      }
    });
    resetField("password");
  }
  async function resend() {
    if (!await trigger("email")) return;
    await run(async () => {
      await resendSignUpCode({ username: emailSchema.parse(getValues("email")) });
      setNotice("Ein neuer Bestätigungscode wurde angefordert. Bitte prüfe auch deinen Spam-Ordner.");
    });
  }

  if (step === "authorized") return <>{children}</>;
  if (step === "checking") {
    return <GateScreen title={TITLES[step]}><LoadingNotice>Anmeldung wird geprüft …</LoadingNotice></GateScreen>;
  }
  if (step === "pending" || step === "sessionError") {
    return <GateScreen title={TITLES[step]}>
      <div className="rl-adm-login-hero">
        <RateLamaMascot state="intro" size={140} decorative className="rl-adm-login-llama" />
        <span className="rl-eyebrow">BASISLAGER · QUIZMASTER</span>
        <h1 className="rl-title">{TITLES[step]}</h1>
      </div>
      {step === "pending" && <p className="rl-adm-login-lead">Dein Konto wartet auf die Quizmaster-Freigabe. Die Administration
        muss dich in Cognito der Gruppe „Quizmasters“ zuordnen.</p>}
      <ErrorNotice error={error} />
      <div className="rl-adm-login-links">
        <button type="button" className="rl-btn rl-btn-primary rl-btn-block" disabled={busy}
          onClick={() => void run(() => access(true))}>Zugriff erneut prüfen</button>
        <button type="button" className="rl-btn rl-btn-secondary rl-btn-block" disabled={busy} onClick={() => void run(async () => {
          await signOut(); changeStep("signIn");
        })}>Abmelden</button>
      </div>
    </GateScreen>;
  }

  const passwordLabel = step === "newPassword" ? "Neues Passwort" : "Passwort";
  return <GateScreen title={TITLES[step]}>
    <div className="rl-adm-login-hero">
      <RateLamaMascot state="intro" size={140} decorative className="rl-adm-login-llama" />
      <span className="rl-eyebrow">BASISLAGER · QUIZMASTER</span>
      <h1 className="rl-title">{TITLES[step]} <Sparkle className="rl-title-sparkle" /></h1>
    </div>
    <p className="rl-adm-login-lead">{step === "confirm" ? "Gib den sechsstelligen Code aus deiner Bestätigungs-E-Mail ein." :
      "Neue Konten erhalten erst nach manueller Freigabe durch die Administration Quizmaster-Rechte."}</p>
    {step === "signUp" && <p className="rl-adm-privacy"><ShieldCheck aria-hidden="true" />
      <span>Für dein Quizmaster-Konto wird deine E-Mail-Adresse gespeichert. Zum Mitspielen brauchst du kein Konto.</span></p>}
    <ErrorNotice error={error} />
    {notice && <p role="status" className="rl-adm-status">{notice}</p>}
    <form className="rl-form-card rl-adm-login-form" onSubmit={handleSubmit(submit)} noValidate>
      {step !== "newPassword" && <div className="rl-field">
        <label className="rl-field-label" htmlFor="admin-email"><Mail aria-hidden="true" /> E-Mail-Adresse</label>
        <input id="admin-email" className="rl-input" type="email" autoComplete="username" maxLength={254} aria-label="E-Mail-Adresse"
          disabled={busy} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "admin-email-error" : undefined}
          {...register("email")} />
        <FieldError id="admin-email-error" text={errors.email?.message} />
      </div>}
      {step !== "confirm" && <div className="rl-field">
        <label className="rl-field-label" htmlFor="admin-password"><KeyRound aria-hidden="true" /> {passwordLabel}</label>
        <input id="admin-password" className="rl-input" type="password" maxLength={256}
          autoComplete={step === "signIn" ? "current-password" : "new-password"} disabled={busy} aria-label={passwordLabel}
          aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "admin-password-error" : undefined}
          {...register("password")} />
        <FieldError id="admin-password-error" text={errors.password?.message} />
      </div>}
      {step === "confirm" && <div className="rl-field">
        <label className="rl-field-label" htmlFor="admin-code"><ShieldCheck aria-hidden="true" /> Bestätigungscode</label>
        <input id="admin-code" className="rl-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          aria-label="Bestätigungscode" disabled={busy} aria-invalid={Boolean(errors.code)}
          aria-describedby={errors.code ? "admin-code-error" : undefined} {...register("code")} />
        <FieldError id="admin-code-error" text={errors.code?.message} />
      </div>}
      <button type="submit" className="rl-start-button" disabled={busy}>
        {step === "signIn" && <LogIn strokeWidth={2.8} aria-hidden="true" />}
        {step === "signUp" ? "Konto anlegen" : step === "confirm" ? "E-Mail bestätigen" : step === "newPassword" ? "Passwort setzen" : "Anmelden"}
      </button>
    </form>
    <div className="rl-adm-login-links">
      {step === "signIn" && <button type="button" className="rl-btn rl-btn-secondary rl-btn-block" disabled={busy}
        onClick={() => changeStep("signUp")}>Konto anlegen</button>}
      {step === "signIn" && <button type="button" className="rl-btn rl-btn-ghost rl-btn-block" disabled={busy}
        onClick={() => changeStep("confirm")}>E-Mail-Bestätigung fortsetzen</button>}
      {step === "confirm" && <button type="button" className="rl-btn rl-btn-secondary rl-btn-block" disabled={busy}
        onClick={() => void resend()}>Code erneut senden</button>}
      {step !== "signIn" && <button type="button" className="rl-btn rl-btn-ghost rl-btn-block" disabled={busy}
        onClick={() => changeStep("signIn")}>Zur Anmeldung</button>}
    </div>
  </GateScreen>;
}
