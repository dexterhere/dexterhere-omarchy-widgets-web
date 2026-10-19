<script lang="ts">
  import { docsUrl } from '../../lib/site';
  import CopyButton from '../../lib/components/CopyButton.svelte';

  // Kept in script so the angle brackets and braces are shown as text, not parsed as markup.
  const planned = {
    scaffold: 'ow new <id> --template <name>',
    check: 'ow check',
    publish: 'ow publish --listing'
  };
  const gitCommit = 'git rev-parse HEAD';
  const listing = `{
  "id": "io.github.you.github-activity",
  "repo": "https://github.com/you/omarchy-github-activity",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "categories": ["dev-git", "productivity"],
  "tags": ["github", "pull-requests"],
  "summary": "Open PRs and review requests at a glance.",
  "status": "alpha"
}`;
  const listingPath = 'registry/widgets/io.github.you.github-activity.json';
</script>

<svelte:head>
  <title>Publish a widget - Omarchy Widgets</title>
</svelte:head>

<div class="site-frame stack page">
  <h1>Publish a widget</h1>
  <p class="prose text-2">
    This page takes you from an empty folder to a listed widget. Listing a widget does not install
    anything, and it does not make the widget reviewed or safe. Read the
    <a href="#trust-tiers">trust tiers</a> before you start.
  </p>

  <div class="box notice">
    <p class="small">
      <span class="badge">Planned</span> The commands <code>ow new</code>, <code>ow check</code> and
      <code>ow publish --listing</code> do not exist yet. Each step shows the manual way to do the same
      thing, which works today.
    </p>
  </div>

  <section class="section" aria-labelledby="steps-heading">
    <h2 id="steps-heading">Steps</h2>
    <ol class="steps">
      <li>
        <h3>Pick a path</h3>
        <p>
          Choose a spec widget (JSON, no code, the easiest to list) or a code widget (QML, not
          sandboxed, runs as you).
        </p>
      </li>

      <li>
        <h3>Scaffold</h3>
        <p>Create a widget folder with its metadata, README, license and preview.</p>
        <div class="pair">
          <div>
            <p class="small"><span class="badge">Planned</span> Command</p>
            <pre><code>{planned.scaffold}</code></pre>
            <CopyButton text={planned.scaffold} />
          </div>
          <div>
            <p class="small text-2">Manual equivalent</p>
            <p>
              Make a folder with <code>manifest.json</code>, <code>widget.json</code>, a README, a
              license file and a preview image.
            </p>
          </div>
        </div>
      </li>

      <li>
        <h3>Develop</h3>
        <p>Develop against a throwaway shell configuration, never your real one.</p>
      </li>

      <li>
        <h3>Check</h3>
        <p>
          Check that both JSON files are valid and that your code uses only the capabilities you
          declare.
        </p>
        <div class="pair">
          <div>
            <p class="small"><span class="badge">Planned</span> Command</p>
            <pre><code>{planned.check}</code></pre>
            <CopyButton text={planned.check} />
          </div>
          <div>
            <p class="small text-2">Manual equivalent</p>
            <p>
              Validate <code>manifest.json</code> and <code>widget.json</code> against the schemas
              in the code repository's <code>spec/</code> folder, then check your capabilities by reading
              your own code.
            </p>
          </div>
        </div>
      </li>

      <li>
        <h3>Publish your repo</h3>
        <p>
          Put the widget in its own public repository, with <code>manifest.json</code> at the root, a
          license and a README with install and removal steps.
        </p>
        <p class="small text-2">Then note the full commit SHA you want listed.</p>
        <div>
          <p class="small text-2">Get the commit to list</p>
          <pre><code>{gitCommit}</code></pre>
          <CopyButton text={gitCommit} />
        </div>
      </li>

      <li>
        <h3>Submit the listing</h3>
        <p>
          Open a pull request here that adds <code>{listingPath}</code>, using the example below.
        </p>
        <div class="pair">
          <div>
            <p class="small"><span class="badge">Planned</span> Command</p>
            <pre><code>{planned.publish}</code></pre>
            <CopyButton text={planned.publish} />
          </div>
          <div>
            <p class="small text-2">Manual equivalent</p>
            <p>Write the file by hand, then open the pull request with the template checklist.</p>
          </div>
        </div>

        <div class="listing">
          <p class="small text-2">Listing example</p>
          <pre><code>{listing}</code></pre>
          <CopyButton text={listing} label="Copy listing" />
        </div>

        <dl class="fields small">
          <div>
            <dt><code>id</code></dt>
            <dd>
              Reverse-domain form, the same id as in <code>manifest.json</code> and
              <code>widget.json</code>.
            </dd>
          </div>
          <div>
            <dt><code>repo</code></dt>
            <dd>A public repository on github.com.</dd>
          </div>
          <div>
            <dt><code>commit</code></dt>
            <dd>The full 40-character commit SHA. Branch names and tags are not accepted.</dd>
          </div>
          <div>
            <dt><code>status</code></dt>
            <dd>
              <code>planned</code>, <code>alpha</code> or <code>stable</code>, shown on the site.
            </dd>
          </div>
        </dl>
        <p class="small text-2">
          The listing never sets the trust tier. Do not add tier or review fields, or the listing
          fails CI.
        </p>
      </li>

      <li>
        <h3>Review and merge</h3>
        <p>
          CI checks your files and posts the access summary on the pull request, then a maintainer
          reads the pinned commit and sets the trust tier.
        </p>
        <p class="small text-2">
          After merge the widget appears at the next site build. To update it, open a pull request
          that changes the commit.
        </p>
      </li>
    </ol>
  </section>

  <section class="section" aria-labelledby="ci-heading">
    <h2 id="ci-heading">What CI checks</h2>
    <ul class="list">
      <li>The listing matches its schema.</li>
      <li>
        <code>manifest.json</code> and <code>widget.json</code> are fetched only from the pinned commit
        on github.com raw, with a size cap and a timeout.
      </li>
      <li>
        <code>widget.json</code> is valid against the schema, and the id matches the listing and
        <code>manifest.json</code>.
      </li>
      <li>
        The capability summary (network, files, spawning, providers, topics) is posted on the pull
        request.
      </li>
    </ul>
    <p class="small text-2">
      CI cannot see what your code does at runtime. Reviewers read the pinned commit.
    </p>
  </section>

  <section class="section" id="trust-tiers" aria-labelledby="tiers-heading">
    <h2 id="tiers-heading">Trust tiers</h2>
    <p>
      Tiers are set by maintainers only. A listing cannot claim one. A tier describes review, not
      isolation.
    </p>
    <dl class="tiers">
      <div>
        <dt><code>core</code></dt>
        <dd>Maintained by this project.</dd>
      </div>
      <div>
        <dt><code>verified</code></dt>
        <dd>
          A maintainer read the pinned commit and recorded the review. Review is not isolation.
        </dd>
      </div>
      <div>
        <dt><code>spec</code></dt>
        <dd>
          Schema-valid JSON with no custom code. The widget gets only the fields it is granted.
        </dd>
      </div>
      <div>
        <dt><code>community</code></dt>
        <dd>
          Unreviewed code. It is not sandboxed and runs as you, so it can read anything you can
          read.
        </dd>
      </div>
    </dl>
  </section>

  <section class="section" aria-labelledby="next-heading">
    <h2 id="next-heading">Where to go next</h2>
    <ul class="list">
      <li><a href={docsUrl('/docs')}>Docs</a></li>
      <li>
        <a
          href="https://github.com/dexterhere/dexterhere-omarchy-widgets-web/blob/main/CONTRIBUTING.md"
          rel="noopener noreferrer">CONTRIBUTING.md on GitHub</a
        >
      </li>
      <li>
        <a
          href="https://github.com/dexterhere/dexterhere-omarchy-widgets-web/tree/main/.github/PULL_REQUEST_TEMPLATE"
          rel="noopener noreferrer">Pull request templates</a
        >
      </li>
    </ul>
  </section>
</div>

<style>
  .page {
    padding-block: 64px;
  }
  .notice {
    padding: 16px;
  }
  .badge {
    display: inline-block;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    background: var(--surface-2);
    color: var(--text);
    font-size: var(--fs-1);
    line-height: 20px;
  }
  .steps {
    margin: 0;
    padding-left: 24px;
  }
  .steps > li {
    margin-bottom: 40px;
    padding-left: 8px;
  }
  .steps h3 {
    margin-bottom: 8px;
  }
  .steps > li > * + * {
    margin-top: 16px;
  }
  .steps pre {
    margin-bottom: 12px;
  }
  .pair > div > * + * {
    margin-top: 8px;
  }
  .pair {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(0, 1fr);
  }
  .pair > div {
    min-width: 0;
  }
  @media (min-width: 720px) {
    .pair {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .list {
    margin: 0;
    padding-left: 24px;
    display: grid;
    gap: 8px;
  }
  .fields,
  .tiers {
    margin: 16px 0 0;
  }
  .fields > div,
  .tiers > div {
    padding-block: 12px;
    border-top: 1px solid var(--border);
  }
  dt {
    font-weight: 700;
  }
  dd {
    margin: 4px 0 0;
  }
</style>
