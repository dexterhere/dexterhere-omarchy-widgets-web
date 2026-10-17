<script lang="ts">
  import { sitePath } from '../site';
</script>

<footer class="site-footer">
  <div class="container wide foot">
    <p class="small">Independent of Omarchy and 37signals. MIT licensed.</p>
    <nav aria-label="Footer" class="small">
      <a href={sitePath('/security')}>Security</a>
      <a href="https://github.com/dexterhere/omarchy-widgets" rel="noopener noreferrer">GitHub</a>
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: 64px;
    border-top: 1px solid var(--border);
    padding-block: 24px;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 32px;
    justify-content: space-between;
  }
  nav {
    display: flex;
    gap: 24px;
  }
</style>
