import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { getLegalPageCopy } from "@/i18n/legal-pages";
import { getRequestLocale } from "@/i18n/server";

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const copy = getLegalPageCopy(locale, "privacy");

  return (
    <LegalDocumentPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      summary={copy.summary}
      updatedAt={copy.updatedAt}
      sections={copy.sections}
      homeLabel={copy.homeLabel}
      loginLabel={copy.loginLabel}
    />
  );
}
