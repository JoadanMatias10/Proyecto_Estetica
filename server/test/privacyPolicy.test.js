const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { createPrivacyPolicyRouter } = require('../routes/privacyPolicy');
const { renderPrivacyPolicyPage } = require('../utils/privacyPolicy');
const policy = require('../data/privacy-policy.json');

test('publica el aviso completo como HTML sin inicio de sesión, PDF ni JavaScript', async (t) => {
  const app = express();
  app.use('/api/public/privacy-policy', createPrivacyPolicyRouter());
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/public/privacy-policy`;
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html; charset=utf-8/);
  assert.equal(response.headers.get('set-cookie'), null);
  const html = await response.text();
  assert.match(html, /<h1>Política de privacidad<\/h1>/);
  assert.match(html, /8\. Derechos ARCO y revocación/);
  assert.match(html, /14\. Cambios al aviso y protección de derechos/);
  assert.match(html, /<p>El plazo para comunicar la determinación es de hasta 20 días hábiles/);
  assert.match(html, /href="\/api\/public\/account-deletion"/);
  assert.match(html, /href="https:\/\/proyecto-estetica\.vercel\.app\/">← Volver al sitio web<\/a>/);
  assert.doesNotMatch(html, /<script|<iframe|<object|<embed|\.pdf["']/i);
  assert.doesNotMatch(html, /ALUMNO:|CONTRATO DE RESPONSABILIDAD LEGAL/);
  const css = await fetch(`${base}/assets/style.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
});

test('el contenido del aviso se presenta como texto, incluso si contiene etiquetas o comillas', () => {
  const fixture = structuredClone(policy);
  fixture.sections[0].paragraphs = ['Texto <script>alert("x")</script> & privacidad'];
  const html = renderPrivacyPolicyPage(fixture);
  assert.match(html, /Texto &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; privacidad/);
  assert.doesNotMatch(html, /<script>/);
});
