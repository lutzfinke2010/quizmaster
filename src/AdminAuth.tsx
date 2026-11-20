import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import {
  confirmSignIn, confirmSignUp, fetchAuthSession, getCurrentUser, resendSignUpCode, signIn, signOut, signUp,
} from "aws-amplify/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { adminAccess, authMessage, emailSchema, passwordSchema } from "./domain/adminAuth";
import { ErrorBanner, Layout, LoadingNotice } from "./components/Layout";
import { Button } from "./components/ui/button";
import { ShieldCheck, Sparkles } from "lucide-react";

type Step = "checking" | "signIn" | "signUp" | "confirm" | "newPassword" | "pending" | "authorized" | "sessionError";
type Fields = { email: string; password: string; code: string };

export function AdminGate({ children }: { children: React.ReactNode }) {
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
    // Ohne Anmeldung keine Sitzung anfordern: fetchAuthSession würde sonst eine anonyme Gast-Kennung erzeugen.
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
  if (step === "checking") return <Layout><LoadingNotice>Anmeldung wird geprüft …</LoadingNotice></Layout>;
  if (step === "pending" || step === "sessionError") {
    return <Layout><div className="login-card"><h1>{step === "pending" ? "Freigabe ausstehend" : "Anmeldung prüfen"}</h1>
      {step === "pending" && <p>Dein Konto wartet auf die Quizmaster-Freigabe. Die Administration muss dich in Cognito der Gruppe „Quizmasters“ zuordnen.</p>}
      <ErrorBanner error={error} />
      <div className="actions"><Button disabled={busy} className="button primary"
        onClick={() => void run(() => access(true))}>Zugriff erneut prüfen</Button>
      <Button disabled={busy} className="button secondary" onClick={() => void run(async () => {
        await signOut(); changeStep("signIn");
      })}>Abmelden</Button></div></div></Layout>;
  }
  return <Layout><div className="login-card">
    <span className="login-icon"><Sparkles size={26} aria-hidden="true" /></span>
    <span className="eyebrow">BASISLAGER · QUIZMASTER</span>
    <h1>{step === "signUp" ? "Quizmaster-Konto anlegen" : step === "confirm" ? "E-Mail-Adresse bestätigen" :
      step === "newPassword" ? "Neues Passwort setzen" : "Quizmaster-Anmeldung"}</h1>
    <p>{step === "confirm" ? "Gib den sechsstelligen Code aus deiner Bestätigungs-E-Mail ein." :
      "Neue Konten erhalten erst nach manueller Freigabe durch die Administration Quizmaster-Rechte."}</p>
    {step === "signUp" && <p className="local-notice"><ShieldCheck size={20} aria-hidden="true" />
      <span>Für dein Quizmaster-Konto wird deine E-Mail-Adresse gespeichert. Zum Mitspielen brauchst du kein Konto.</span></p>}
    <ErrorBanner error={error} />{notice && <p role="status">{notice}</p>}
    <form onSubmit={handleSubmit(submit)} noValidate>
      {step !== "newPassword" && <label className="field">E-Mail-Adresse
        <input type="email" autoComplete="username" maxLength={254} aria-label="E-Mail-Adresse"
          disabled={busy} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "admin-email-error" : undefined} {...register("email")} />
        {errors.email && <span id="admin-email-error" className="field-error" role="alert">{errors.email.message}</span>}
      </label>}
      {step !== "confirm" && <label className="field">{step === "newPassword" ? "Neues Passwort" : "Passwort"}
        <input type="password" autoComplete={step === "signIn" ? "current-password" : "new-password"} maxLength={256}
          disabled={busy} aria-label={step === "newPassword" ? "Neues Passwort" : "Passwort"} aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "admin-password-error" : undefined} {...register("password")} />
        {errors.password && <span id="admin-password-error" className="field-error" role="alert">{errors.password.message}</span>}
      </label>}
      {step === "confirm" && <label className="field">Bestätigungscode
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Bestätigungscode"
          disabled={busy} aria-invalid={Boolean(errors.code)} aria-describedby={errors.code ? "admin-code-error" : undefined} {...register("code")} />
        {errors.code && <span id="admin-code-error" className="field-error" role="alert">{errors.code.message}</span>}
      </label>}
      <Button type="submit" className="button primary" disabled={busy}>
        {step === "signUp" ? "Konto anlegen" : step === "confirm" ? "E-Mail bestätigen" : step === "newPassword" ? "Passwort setzen" : "Anmelden"}
      </Button>
    </form>
    <div className="actions">
      {step === "signIn" && <Button className="button secondary" disabled={busy} onClick={() => changeStep("signUp")}>Konto anlegen</Button>}
      {step === "signIn" && <Button className="button secondary" disabled={busy} onClick={() => changeStep("confirm")}>E-Mail-Bestätigung fortsetzen</Button>}
      {step === "confirm" && <Button className="button secondary" disabled={busy} onClick={() => void resend()}>Code erneut senden</Button>}
      {step !== "signIn" && <Button className="button secondary" disabled={busy} onClick={() => changeStep("signIn")}>Zur Anmeldung</Button>}
    </div>
  </div></Layout>;
}
