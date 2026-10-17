// The few Bun APIs scripts/ use (the project does not depend on @types/bun).
declare const Bun: {
  serve(options: {
    hostname: string;
    port: number;
    fetch(req: Request): Response | Promise<Response>;
  }): { port: number; stop(closeActive?: boolean): void };
  spawnSync(
    cmd: string[],
    options: {
      cwd?: string;
      env?: Record<string, string | undefined>;
      stdout?: 'inherit' | 'pipe';
      stderr?: 'inherit' | 'pipe';
    }
  ): { exitCode: number };
};
