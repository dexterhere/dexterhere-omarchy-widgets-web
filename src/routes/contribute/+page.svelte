<script lang="ts">
  import Seo from '../../lib/components/Seo.svelte';
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

<Seo
  title="Publish a widget"
  description="Take a widget from an empty folder to a listing: write the spec or QML code, test it and open a pull request. Listing a widget is not a safety review."
  path="/contribute/"
/>

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
              Validate <code>manifest.json</code> and <code>widget.json</code> against the draft
              schemas in this website's repository (<code>registry/schema/widget.schema.json</code
              >), then check your capabilities by reading your own code. Run
              <code>bun run registry</code>
              to build the registry locally; set <code>GITHUB_TOKEN</code> to avoid GitHub's 60 requests
              per hour limit.
            </p>
          </div>
        </div>
      </li>

      <li>
        <h3>Publish your repo</h3>
        <p>
          Put the widget in its own public repository, with <code>manifest.json</code> (including a
          <code>license</code> field), <code>widget.json</code>, a LICENSE file and a README with
          install and removal steps. A spec widget also needs <code>layout.json</code>. The license
          must be one of: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, GPL-3.0,
          LGPL-3.0, AGPL-3.0, Unlicense, 0BSD, and must match <code>manifest.json</code>.
        </p>
        <p class="small text-2">
          Then note the full commit SHA you want listed. It must be on the default branch.
        </p>
        <div>
          <p class="small text-2">Get the commit to list</p>
          <pre><code>{gitCommit}</code></pre>
          <CopyButton text={gitCommit} />
        </div>
      </li>

      <li>
        <h3>Submit the listing</h3>
        <p>
          Open a pull request here, from your own GitHub account, that adds <code
            >{listingPath}</code
          >, using the example below. The account name must match the id:
          <code>io.github.&lt;your-login&gt;.&lt;name&gt;</code>.
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
              <code>planned</code>, <code>alpha</code>, <code>stable</code> or <code>removed</code>.
              The first three are shown on the site. <code>removed</code> is a takedown that you can set
              yourself, or you can delete the file.
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
          CI validates your listing and your files, then a maintainer reads the pinned commit and
          merges. Review has no promised turnaround.
        </p>
        <p class="small text-2">
          Merge is not publish. A maintainer must also approve the listing in
          <code>registry/lock.json</code>. Until then it is left out as "pending maintainer
          approval", even if the pull request is green. After approval the widget appears at the
          next site build. To update it, open a pull request that changes the commit.
        </p>
      </li>
    </ol>
  </section>

  <section class="section" aria-labelledby="flow-heading">
    <h2 id="flow-heading">From pull request to published</h2>
    <ol class="flow">
      <li><strong>Author.</strong> Opens a pull request that adds the listing file.</li>
      <li>
        <strong>CI.</strong> Runs the registry build in strict mode and the author check. Nothing from
        your repository is run.
      </li>
      <li><strong>Maintainer.</strong> Reads the pinned commit and merges.</li>
      <li>
        <strong>Maintainer.</strong> Records the repository and owner ids in
        <code>registry/lock.json</code>. Without this the listing stays pending.
      </li>
      <li>
        <strong>Site.</strong> The next build runs the registry build and publishes the listing.
      </li>
    </ol>
    <p class="small text-2">
      Today <code>lock.json</code> holds only the maintainers' seven widgets, all still planned and not
      installable.
    </p>
  </section>

  <section class="section" aria-labelledby="ci-heading">
    <h2 id="ci-heading">What CI checks</h2>
    <ul class="list">
      <li>
        The listing matches its schema, and the pull request author owns
        <code>io.github.&lt;owner&gt;</code> in the id (or is a maintainer).
      </li>
      <li>
        <code>manifest.json</code>, <code>widget.json</code> and, for spec widgets,
        <code>layout.json</code> are fetched only from the pinned commit on github.com raw, with a size
        cap and a timeout.
      </li>
      <li>
        The commit is on the default branch, the detected license is on the allow-list and equals
        the manifest <code>license</code>, and the ids match.
      </li>
      <li>
        <code>widget.json</code> is valid against the schema, and a spec widget's layout is valid.
      </li>
      <li>
        Plus the site's own checks: type check, lint, theme contrast, unit, end-to-end and
        accessibility tests, and a dependency audit.
      </li>
    </ul>
    <p class="small text-2">
      CI does not post an access summary, build a preview of the listing, or run the stricter gate
      scripts in <code>scripts/gate/</code> yet. CI cannot see what your code does at runtime. Reviewers
      read the pinned commit and compare capabilities by hand.
    </p>
  </section>

  <section class="section" id="trust-tiers" aria-labelledby="tiers-heading">
    <h2 id="tiers-heading">Trust tiers</h2>
    <p>
      Tiers are set by maintainers only. A listing cannot claim one, and nothing sets a tier
      automatically. A tier applies only to the reviewed commit; a new commit goes back to
      <code>community</code>. A tier describes review, not isolation.
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
          A maintainer reviewed a schema-valid JSON widget with no custom code. Until then it is
          <code>community</code>, even if its <code>widget.json</code> says <code>spec</code>.
        </dd>
      </div>
      <div>
        <dt><code>community</code></dt>
        <dd>
          Not reviewed. This is the default for every listing. Code widgets are not sandboxed and
          run as you, so they can read anything you can read.
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
  .flow {
    margin: 0;
    padding-left: 24px;
    display: grid;
    gap: 8px;
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
