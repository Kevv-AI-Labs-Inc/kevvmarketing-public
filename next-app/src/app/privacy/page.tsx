import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { pickText } from "@/i18n/copy";
import { legalPagesCopy } from "@/i18n/legal-pages";
import { getRequestLocale } from "@/i18n/server";

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const copy = legalPagesCopy.privacy;

  return (
    <LegalDocumentPage
      eyebrow={pickText(locale, copy.eyebrow)}
      title={pickText(locale, copy.title)}
      summary={pickText(locale, copy.summary)}
      updatedAt={pickText(locale, copy.updatedAt)}
      sections={copy.sections.map((section) => ({
        heading: pickText(locale, section.heading),
        paragraphs: section.paragraphs.map((paragraph) => pickText(locale, paragraph)),
      }))}
      homeLabel={locale === "zh" ? "返回首页" : "Back home"}
      loginLabel={locale === "zh" ? "登录" : "Sign in"}
    />
  );
}
