function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderPrivacyPolicyPage(policy) {
  const escape = escapeHtml;
  const siteUrl = "https://proyecto-estetica.vercel.app/";
  const contents = policy.sections.map((section) =>
    '<li><a href="#' + escape(section.id) + '">' + escape(section.title) + '</a></li>'
  ).join("\n");
  const sections = policy.sections.map((section) =>
    '<section id="' + escape(section.id) + '" aria-labelledby="' + escape(section.id) + '-title">'
    + '<h2 id="' + escape(section.id) + '-title">' + escape(section.title) + '</h2>'
    + section.paragraphs.map((paragraph) => '<p>' + escape(paragraph) + '</p>').join("\n")
    + (section.items?.length ? '<ul>' + section.items.map((item) => '<li>' + escape(item) + '</li>').join("\n") + '</ul>' : "")
    + '</section>'
  ).join("\n");
  return '<!doctype html>\n<html lang="es">\n<head>\n'
    + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="description" content="Política de privacidad de Estética Panamericana: datos personales, derechos y eliminación de cuentas.">'
    + '<title>' + escape(policy.title) + ' · ' + escape(policy.companyName) + '</title>'
    + '<link rel="stylesheet" href="/api/public/privacy-policy/assets/style.css">'
    + '</head>\n<body><a class="skip-link" href="#contenido">Ir al contenido</a><main id="contenido">'
    + '<a class="back-link" href="' + siteUrl + '">← Volver al sitio web</a>'
    + '<header><span class="brand">' + escape(policy.companyName) + '</span>'
    + '<h1>' + escape(policy.title) + '</h1><p class="subtitle">' + escape(policy.subtitle) + '</p>'
    + '<p class="updated">Última actualización: <time datetime="' + escape(policy.updatedAt) + '">' + escape(policy.updatedAtText) + '</time></p>'
    + '<p>' + escape(policy.introduction) + '</p></header>'
    + '<aside class="contact" aria-labelledby="contacto"><h2 id="contacto">Contacto de privacidad</h2>'
    + '<a href="mailto:' + escape(policy.contact.email) + '">' + escape(policy.contact.email) + '</a>'
    + '<a href="tel:' + escape(policy.contact.phone.replace(/[^\d+]/g, "")) + '">' + escape(policy.contact.phone) + '</a>'
    + '<p>' + escape(policy.contact.address) + '</p></aside>'
    + '<nav aria-label="Contenido del aviso"><h2>Contenido del aviso</h2><ol>' + contents + '</ol></nav>'
    + sections
    + '<div class="actions"><a class="button" href="/api/public/account-deletion">Solicitar eliminación de cuenta</a>'
    + '<a href="#contenido">Volver al inicio del aviso</a>'
    + '<a href="' + siteUrl + '">Volver al sitio web</a></div>'
    + '<footer>' + escape(policy.companyName) + ' · ' + escape(policy.title) + '</footer>'
    + '</main></body></html>';
}

module.exports = { renderPrivacyPolicyPage };
