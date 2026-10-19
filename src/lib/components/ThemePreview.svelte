<script lang="ts">
  // A mini desktop drawn from one theme's tokens with CSS only. data-theme scopes the tokens
  // to this element, so it shows that theme whatever the page is using.
  let { id }: { id: string } = $props();
</script>

<span class="desk" data-theme={id} aria-hidden="true">
  <span class="bar">
    <i class="logo"></i>
    <i class="ws on"></i><i class="ws"></i><i class="ws"></i>
    <b class="clock"></b>
  </span>
  <span class="field">
    <span class="w w1"><i class="big"></i><i class="ln"></i><i class="ln short"></i></span>
    <span class="w w2"
      ><i class="col c1"></i><i class="col c2"></i><i class="col c3"></i><i class="col c4"></i><i
        class="col c5"
      ></i></span
    >
    <span class="w w3"><i class="ln"></i><i class="ln"></i><i class="pill"></i></span>
    <i class="px p1"></i><i class="px p2"></i><i class="px p3"></i>
  </span>
</span>

<style>
  .desk {
    display: block;
    container-type: inline-size;
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border-strong);
  }
  i,
  b {
    display: block;
    position: absolute;
    font-style: normal;
  }
  .bar {
    position: absolute;
    inset: 0 0 auto 0;
    height: 7cqw;
    background: var(--bg-deep);
    border-bottom: 1px solid var(--border);
  }
  .logo {
    left: 2.4cqw;
    top: 2cqw;
    width: 3cqw;
    height: 3cqw;
    background: var(--brand);
  }
  .ws {
    top: 2.4cqw;
    width: 2.2cqw;
    height: 2.2cqw;
    border: 1px solid var(--border-strong);
  }
  .ws:nth-of-type(2) {
    left: 8cqw;
  }
  .ws:nth-of-type(3) {
    left: 11.2cqw;
  }
  .ws:nth-of-type(4) {
    left: 14.4cqw;
  }
  .ws.on {
    background: var(--text);
    border-color: var(--text);
  }
  .clock {
    right: 2.4cqw;
    top: 2.4cqw;
    width: 9cqw;
    height: 2.2cqw;
    background: var(--text-2);
  }
  .field {
    position: absolute;
    inset: 7cqw 0 0 0;
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 4cqw 4cqw;
    opacity: 1;
  }
  .w {
    position: absolute;
    background: var(--surface);
    border: 1px solid var(--border-strong);
  }
  .w1 {
    left: 5cqw;
    top: 5cqw;
    width: 38cqw;
    height: 27cqw;
  }
  .big {
    left: 3cqw;
    top: 3cqw;
    width: 20cqw;
    height: 7cqw;
    background: var(--brand);
  }
  .ln {
    left: 3cqw;
    top: 14cqw;
    width: 28cqw;
    height: 1.6cqw;
    background: var(--muted);
  }
  .ln.short {
    top: 18cqw;
    width: 16cqw;
    background: var(--border-strong);
  }
  .w2 {
    right: 5cqw;
    top: 8cqw;
    width: 36cqw;
    height: 30cqw;
    background: var(--surface-2);
  }
  .col {
    bottom: 3cqw;
    width: 4.4cqw;
    background: var(--brand);
  }
  .c1 {
    left: 3cqw;
    height: 10cqw;
  }
  .c2 {
    left: 9cqw;
    height: 17cqw;
  }
  .c3 {
    left: 15cqw;
    height: 13cqw;
  }
  .c4 {
    left: 21cqw;
    height: 21cqw;
  }
  .c5 {
    left: 27cqw;
    height: 8cqw;
    background: var(--brand-soft);
    outline: 1px solid var(--brand);
  }
  .w3 {
    left: 14cqw;
    bottom: 5cqw;
    width: 44cqw;
    height: 17cqw;
  }
  .w3 .ln {
    top: 3cqw;
    width: 30cqw;
  }
  .w3 .ln + .ln {
    top: 7cqw;
    width: 22cqw;
    background: var(--border-strong);
  }
  .pill {
    left: 3cqw;
    bottom: 2.4cqw;
    width: 10cqw;
    height: 3cqw;
    background: var(--brand-soft);
    border: 1px solid var(--brand);
  }
  .px {
    width: 2cqw;
    height: 2cqw;
    background: var(--brand-soft);
  }
  .p1 {
    right: 12cqw;
    bottom: 6cqw;
  }
  .p2 {
    right: 8cqw;
    bottom: 10cqw;
    background: var(--selection);
  }
  .p3 {
    right: 16cqw;
    bottom: 12cqw;
  }
</style>
