import Link from "next/link";
import type { ReactElement } from "react";
import type { LegalDocument, LegalSection } from "../documents";
import type { LegalContact } from "../legal-info";

const UPDATED_AT_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function SectionView(props: { section: LegalSection }): ReactElement {
  const { section } = props;

  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{section.title}</h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.items != null && (
        <ul className="grid list-disc gap-1 pl-5">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CONTACT_LINK_CLASS =
  "inline-flex min-h-11 items-center font-medium text-primary";

function ContactLink(props: { contact: LegalContact }): ReactElement {
  const { email, supportUrl } = props.contact;

  if (email != null) {
    return (
      <a href={`mailto:${email}`} className={CONTACT_LINK_CLASS}>
        {email}
      </a>
    );
  }

  if (supportUrl == null)
    return <p>Fale com o suporte de onde você comprou.</p>;

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noreferrer"
      className={CONTACT_LINK_CLASS}
    >
      Falar com o suporte
    </a>
  );
}

export function LegalDocumentView(props: {
  document: LegalDocument;
  updatedAt: string;
  contact: LegalContact;
  otherDocument: { href: string; label: string };
}): ReactElement {
  const { document, contact, otherDocument } = props;
  const updatedAt = UPDATED_AT_FORMAT.format(new Date(props.updatedAt));

  return (
    <article className="grid gap-6 text-base leading-relaxed">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {document.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Atualizado em {updatedAt}
        </p>
        <p>{document.intro}</p>
      </header>

      {document.sections.map((section) => (
        <SectionView key={section.title} section={section} />
      ))}

      <section className="grid gap-1 rounded-2xl bg-card p-5">
        <h2 className="text-lg font-semibold">Contato</h2>
        <p>Dúvidas e pedidos sobre estes textos ou sobre os seus dados:</p>
        <ContactLink contact={contact} />
      </section>

      <Link href={otherDocument.href} className={CONTACT_LINK_CLASS}>
        {otherDocument.label}
      </Link>
    </article>
  );
}
