import { usePageTitle } from "../usePageTitle";
import { PageLayout } from "../shell/PageLayout";
import { ImpressumPage, PrivacyPolicyPage } from "./LegalPages";

export function Impressum() {
  usePageTitle("Impressum");
  return <PageLayout><ImpressumPage /></PageLayout>;
}

export function Datenschutz() {
  usePageTitle("Datenschutzerklärung");
  return <PageLayout><PrivacyPolicyPage /></PageLayout>;
}
