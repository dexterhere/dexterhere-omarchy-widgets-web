<script lang="ts">
  import Seo from '../../lib/components/Seo.svelte';
</script>

<Seo
  title="Security"
  description="How Omarchy Widgets protects your data, who it defends against, what is still open, and how to report a vulnerability. Code widgets are not sandboxed."
  path="/security/"
/>

<div class="site-frame stack page">
  <h1>Security</h1>
  <p class="prose text-2">
    Some widgets show private data such as mail and calendar, and code widgets run as you. This page
    says what we protect, who we defend against and how well, what is still open, and how to report
    a problem.
  </p>

  <section class="section" aria-labelledby="protect-heading">
    <h2 id="protect-heading">What we protect</h2>
    <p>
      Credentials, such as tokens and app passwords, and data derived from them, such as mail,
      calendar, notifications and agent usage. The goal is that none of it appears in plain text
      outside process memory, and that a widget receives only what you granted.
    </p>
  </section>

  <section class="section" aria-labelledby="threats-heading">
    <h2 id="threats-heading">Who we defend against, and how well</h2>
    <p class="small text-2">
      This is the draft threat model for the product (daemon, vault and CLI) as it is built today.
    </p>
    <dl class="threats">
      <div>
        <dt>A copy of your files (backup, snapshot, stolen disk, dotfile repo)</dt>
        <dd>
          <span class="label">Protection:</span> The vault file is encrypted (XChaCha20-Poly1305). In
          passphrase mode the key comes from your passphrase through Argon2id. Config files hold references
          only.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> A weak passphrase can be guessed offline.
          The minimum is 12 bytes, so use a long one. A copy of the vault plus the passphrase opens everything,
          and deleting the live file does not erase old copies.
        </dd>
      </div>
      <div>
        <dt>Another user on the machine</dt>
        <dd>
          <span class="label">Protection:</span> Socket directory 0700, socket 0600, and the peer uid
          is checked on every connection.
        </dd>
        <dd><span class="label">What still gets through:</span> Root can do anything.</dd>
      </div>
      <div>
        <dt>Another process of your own user</dt>
        <dd>
          <span class="label">Protection:</span> None by design of Unix. The daemon marks itself
          non-dumpable, which blocks most reads of its memory through <code>/proc</code>.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> A program running as you can ask the daemon
          for whatever its claimed widget id is granted, and can read any file you own. What it can read
          from the keyring with automatic login is not yet verified.
        </dd>
      </div>
      <div>
        <dt>A buggy or malicious code widget (QML)</dt>
        <dd>
          <span class="label">Protection:</span> Review tiers, declared capabilities, and lint (later).
          The daemon checks grants, but the widget id is self-claimed.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> Code widgets are not sandboxed. They run
          as you and can bypass any same-user guardrail. Treat installing one like installing a program.
        </dd>
      </div>
      <div>
        <dt>A spec widget (declarative JSON, no code)</dt>
        <dd>
          <span class="label">Protection:</span> Only the trusted renderer talks to the bridge, and the
          widget sees granted fields only.
        </dd>
        <dd><span class="label">What still gets through:</span> Whatever you granted.</dd>
      </div>
      <div>
        <dt>Leaks through logs, arguments, environment and crash dumps</dt>
        <dd>
          <span class="label">Protection:</span> Secrets are read only from a no-echo prompt or stdin,
          never from arguments or the environment. The audit log has no value field. Core dumps are off.
          Tests run the real binaries and search their output and files.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> Your terminal scrollback and screen recordings.
        </dd>
      </div>
      <div>
        <dt>A hostile local client of the daemon</dt>
        <dd>
          <span class="label">Protection:</span> Line limits, bad-frame disconnects, and caps on connections,
          subscriptions, queue depth and output size. Parameters are limited to what each topic declares.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> A client running as you can use its share
          of those limits.
        </dd>
      </div>
      <div>
        <dt>A tampered vault file</dt>
        <dd>
          <span class="label">Protection:</span> Header, wrapped key and payload are all authenticated.
          A wrong key and tampering look the same. The parser is fuzzed.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> Rolling the whole file back to an older
          valid copy is not detected, because there is no freshness counter.
        </dd>
      </div>
      <div>
        <dt>The supply chain</dt>
        <dd>
          <span class="label">Protection:</span> Locked dependencies, <code>cargo audit</code> and
          <code>cargo deny</code> in CI, and a small crypto surface from RustCrypto.
        </dd>
        <dd>
          <span class="label">What still gets through:</span> A compromised upstream release. Signed releases
          and an SBOM are planned.
        </dd>
      </div>
    </dl>
  </section>

  <section class="section" aria-labelledby="limits-heading">
    <h2 id="limits-heading">Honest limits</h2>
    <ul class="list">
      <li>
        <strong>Same-user malware wins.</strong> The vault protects copies of your data and keeps secrets
        out of logs and configs. It cannot protect against software that runs as you while the vault is
        unlocked.
      </li>
      <li>
        <strong>Keyring mode is weaker than it sounds</strong> on a desktop that logs in automatically.
        That is why passphrase mode exists, and it is the only mode implemented so far.
      </li>
      <li>
        <strong>Widget identity is self-claimed</strong> until the bridge authenticates widgets. Grants
        stop honest widgets from over-reading. They do not stop dishonest ones.
      </li>
      <li>
        <strong>Code widgets are not sandboxed.</strong> A QML code widget runs as you and can read anything
        you can read. Listing one does not make it safe.
      </li>
    </ul>
  </section>

  <section class="section" aria-labelledby="site-heading">
    <h2 id="site-heading">How this website is built</h2>
    <ul class="list">
      <li>It is static. There is no server, account or database to attack.</li>
      <li>
        It sets no cookies, runs no analytics and loads no third-party scripts, fonts or requests.
        Fonts are self-hosted.
      </li>
      <li>
        It carries a Content-Security-Policy as a meta tag: scripts, fonts, images and connections
        are same-origin only, and the single inline script SvelteKit generates is allowed by its
        hash. Styles allow inline declarations because Svelte needs them; they cannot load anything
        from other sites. A meta tag cannot set every protection a response header can, so a
        header-based policy is planned for the host.
      </li>
      <li>
        Rule: listings are data. The build reads them and never executes anything from a listing or
        a widget repository.
      </li>
      <li>
        Rule: nothing from a widget is rendered as Markdown or HTML. Listing text is plain text.
      </li>
      <li>Our end-to-end tests fail if a page makes a request to any host other than its own.</li>
    </ul>
    <p class="small text-2">
      Because the site is static, a fix or takedown reaches visitors at the next build, not
      instantly.
    </p>
  </section>

  <section class="section" aria-labelledby="report-heading">
    <h2 id="report-heading">Report a vulnerability</h2>
    <p>
      Do not open a public issue or pull request. Report it privately through GitHub, and include
      what you found, how to reproduce it and the impact.
    </p>
    <ul class="list">
      <li>
        The widget software (daemon, vault, CLI, QML bridge):
        <a
          href="https://github.com/dexterhere/omarchy-widgets/security/advisories/new"
          rel="noopener noreferrer">report in the code repository</a
        >.
      </li>
      <li>
        This website and its build:
        <a
          href="https://github.com/dexterhere/dexterhere-omarchy-widgets-web/security/advisories/new"
          rel="noopener noreferrer">report in the website repository</a
        >.
      </li>
    </ul>
    <p class="small text-2">
      Code widgets not being sandboxed is a documented limit, not a vulnerability by itself. A trust
      tier is a review decision, not a security report.
    </p>
  </section>
</div>

<style>
  .page {
    padding-block: 64px;
  }
  .label {
    font-weight: 700;
  }
  .threats {
    margin: 16px 0 0;
    display: grid;
    gap: 0;
  }
  .threats > div {
    padding-block: 16px;
    border-top: 1px solid var(--border);
  }
  .threats > div:last-child {
    border-bottom: 1px solid var(--border);
  }
  dt {
    font-weight: 700;
    margin-bottom: 8px;
  }
  dd {
    margin: 0 0 8px;
  }
  .list {
    margin: 0;
    padding-left: 24px;
    display: grid;
    gap: 8px;
  }
  .list + p {
    margin-top: 16px;
  }
</style>
